import { Hono } from 'hono';
import { z } from 'zod';
import { createApiKey, createUser, findApiKeyByEmail, findUserByEmail } from '../db';
import { sendWelcomeEmail } from '../email/send';

export const registerRoute = new Hono();

const registerSchema = z.object({
  email: z.string().email('A valid email address is required.'),
});

registerRoute.post('/auth/register', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Request body must be valid JSON.',
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json(
      {
        error: 'invalid_request',
        message: issues[0]?.message ?? 'Validation failed.',
        details: { fields: issues },
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const { email } = parsed.data;

  // Per DECISIONS.md Decision 4: duplicate registration returns existing key
  const existing = findApiKeyByEmail(email);
  if (existing) {
    const user = findUserByEmail(email);
    return c.json({
      apiKey: existing.key,
      plan: user?.plan ?? 'free',
      limit: user?.calls_limit ?? 500,
      message: `Existing API key returned. Also sent to ${email}.`,
    });
  }

  const user = createUser(email, 'free');
  const record = createApiKey(user.id);

  await sendWelcomeEmail(email, record.key, user.plan);

  return c.json(
    {
      apiKey: record.key,
      plan: user.plan,
      limit: user.calls_limit,
      message: `API key created. Also sent to ${email}.`,
    },
    201,
  );
});
