import { Hono } from 'hono';
import { z } from 'zod';
import { provisionFreeAccount } from '../auth/provision';
import { emailField } from '../utils/email';

export const registerRoute = new Hono();

const registerSchema = z.object({
  email: emailField('A valid email address is required.'),
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

  // Normalization, duplicate handling and the deferred welcome email all live in
  // provisionFreeAccount, shared with the signup page at POST /signup.
  const result = provisionFreeAccount(parsed.data.email);

  return c.json(
    {
      apiKey: result.apiKey,
      plan: result.plan,
      limit: result.limit,
      message: result.created
        ? `API key created. Also sent to ${result.email}.`
        : 'Existing API key returned. No email sent — recover it from the dashboard via /auth/login.',
    },
    result.created ? 201 : 200,
  );
});
