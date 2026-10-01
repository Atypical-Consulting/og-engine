/**
 * Joins a signup back to the page the visitor last read.
 *
 * Three strategies, tried strongest first, because og-engine has two very
 * different signup paths and no single mechanism covers both:
 *
 *  1. `explicit`  — the caller told us the page. The docs SignupForm appends
 *                   ?src=<page path>, and the documented curl snippets carry
 *                   the same param. Exact, and survives a terminal paste.
 *  2. `visitor`   — same browser (same IP + user agent) read a docs page in
 *                   the last 24h. Exact for the in-page signup form.
 *  3. `network`   — same public IP read a docs page in the last 60 minutes.
 *                   This is what catches "read the docs, then ran curl in a
 *                   terminal": the user agent differs, the IP usually does
 *                   not. Correct most of the time, wrong behind shared NAT —
 *                   which is why it is reported as its own confidence tier
 *                   rather than silently mixed in.
 *
 * Anything that matches none of the three is recorded with confidence 'none'
 * so the unattributed share is visible instead of invisible.
 */

import type { Context } from 'hono';
import {
  type AttributionConfidence,
  findLastPageViewByNetwork,
  findLastPageViewByVisitor,
  findSessionEntry,
  getDailySalt,
  type PageViewRecord,
  recordSignupAttribution,
} from '../db/analytics';
import { identifyVisitor, sanitiseSrc } from './identity';

export interface AttributionResult {
  confidence: AttributionConfidence;
  lastPage: string | null;
}

/**
 * Resolve and persist the attribution for a newly created user. Never throws:
 * a failure here must not stop someone from getting their API key.
 */
export function attributeSignup(c: Context, userId: string, apiKeyId: string | null): AttributionResult {
  try {
    const salt = getDailySalt();
    const { visitorHash, networkHash } = identifyVisitor(c, salt);

    const explicit = sanitiseSrc(c.req.query('src'));
    const byVisitor = findLastPageViewByVisitor(visitorHash);
    const seen: PageViewRecord | null = byVisitor ?? findLastPageViewByNetwork(networkHash);

    let confidence: AttributionConfidence;
    if (explicit) confidence = 'explicit';
    else if (byVisitor) confidence = 'visitor';
    else if (seen) confidence = 'network';
    else confidence = 'none';

    const lastPage = explicit ?? seen?.path ?? null;
    const entry = seen ? findSessionEntry(seen.session_id) : null;

    recordSignupAttribution({
      userId,
      apiKeyId,
      lastPage,
      landingPage: entry?.path ?? null,
      sessionId: seen?.session_id ?? null,
      source: seen?.source ?? null,
      referrerHost: seen?.referrer_host ?? null,
      confidence,
    });

    return { confidence, lastPage };
  } catch (err) {
    console.error('[analytics] failed to attribute signup:', err);
    return { confidence: 'none', lastPage: null };
  }
}
