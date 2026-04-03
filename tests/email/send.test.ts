import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock resend before importing send module
vi.mock('resend', () => {
  const mockSend = vi.fn().mockResolvedValue({ id: 'mock-email-id' });
  return {
    Resend: vi.fn().mockImplementation(function () {
      return { emails: { send: mockSend } };
    }),
  };
});

describe('email/send', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_123';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
  });

  it('sendWelcomeEmail sends with correct fields', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    await sendWelcomeEmail('user@example.com', 'oge_sk_abc123', 'free');
    const { Resend } = await import('resend');
    const instance = new Resend('test');
    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        from: expect.stringContaining('OG Engine'),
        subject: expect.stringContaining('API Key'),
      }),
    );
  });

  it('sendUpgradeEmail sends with plan info', async () => {
    const { sendUpgradeEmail } = await import('../../src/email/send');
    await sendUpgradeEmail('user@example.com', 'pro');
    const { Resend } = await import('resend');
    const instance = new Resend('test');
    expect(instance.emails.send).toHaveBeenCalled();
  });

  it('sendDowngradeEmail sends downgrade notice', async () => {
    const { sendDowngradeEmail } = await import('../../src/email/send');
    await sendDowngradeEmail('user@example.com');
    const { Resend } = await import('resend');
    const instance = new Resend('test');
    expect(instance.emails.send).toHaveBeenCalled();
  });

  it('skips silently when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendWelcomeEmail } = await import('../../src/email/send');
    // Should not throw
    await expect(sendWelcomeEmail('user@example.com', 'oge_sk_abc', 'free')).resolves.toBeUndefined();
  });
});
