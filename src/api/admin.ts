import { readFileSync, rmSync } from 'node:fs';
import { Hono } from 'hono';
import { getDb, purgeExpiredMagicLinks, purgeExpiredSessions, resetFreeQuotas } from '../db';
import { sendBackupAlertEmail } from '../email/send';
import { s3DeleteObject, s3ListObjects, s3PutObject } from '../utils/s3';

export const adminRoute = new Hono();

adminRoute.post('/admin/reset-free-quotas', async (c) => {
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }

  const reset = resetFreeQuotas();
  const sessionsPurged = purgeExpiredSessions();
  const magicLinksPurged = purgeExpiredMagicLinks();

  return c.json({
    reset,
    sessionsPurged,
    magicLinksPurged,
    timestamp: new Date().toISOString(),
  });
});

adminRoute.post('/admin/backup-db', async (c) => {
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `/tmp/og-engine-backup-${timestamp}.db`;
  const s3Key = `backups/og-engine-${timestamp}.db`;

  try {
    // VACUUM INTO creates a consistent, defragmented backup snapshot.
    // Safe in WAL mode even under concurrent writes.
    const db = getDb();
    db.exec(`VACUUM INTO '${backupPath}'`);

    const backupBytes = new Uint8Array(readFileSync(backupPath));
    const sizeBytes = backupBytes.length;

    await s3PutObject(s3Key, backupBytes, 'application/octet-stream');

    // Prune backups older than 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const objects = await s3ListObjects('backups/');
    const pruned: string[] = [];
    for (const obj of objects) {
      if (obj.lastModified < cutoff) {
        await s3DeleteObject(obj.key);
        pruned.push(obj.key);
      }
    }

    return c.json({
      success: true,
      key: s3Key,
      sizeBytes,
      pruned,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[backup-db] failed:', message);

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendBackupAlertEmail(adminEmail, message).catch((e) => console.error('[backup-db] alert email failed:', e));
    }

    return c.json({ error: 'backup_failed', message }, 500);
  } finally {
    try {
      rmSync(backupPath);
    } catch {
      // temp file may not exist if VACUUM failed
    }
  }
});
