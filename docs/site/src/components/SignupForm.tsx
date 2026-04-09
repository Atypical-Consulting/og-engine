import { useState, type FormEvent } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface SuccessPayload {
  apiKey: string;
  plan: string;
  limit: number;
  message?: string;
}

const API_BASE = 'https://og-engine.com';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<SuccessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? `Request failed (${res.status}).`);
        setStatus('error');
        return;
      }
      setResult(body as SuccessPayload);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
      setStatus('error');
    }
  }

  async function copyKey() {
    if (!result?.apiKey) return;
    try {
      await navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no-op — browsers without clipboard access */
    }
  }

  return (
    <div className="og-signup not-content">
      {status !== 'success' ? (
        <form onSubmit={onSubmit} className="og-signup-form">
          <label htmlFor="og-signup-email" className="og-signup-label">
            Email address
          </label>
          <div className="og-signup-row">
            <input
              id="og-signup-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className="og-signup-input"
            />
            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="og-signup-submit"
            >
              {status === 'loading' ? 'Creating…' : 'Get my API key'}
            </button>
          </div>
          <p className="og-signup-hint">
            Free forever · 500 renders/month · No credit card
          </p>
          {error && (
            <p className="og-signup-error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="og-signup-success" role="status" aria-live="polite">
          <div className="og-signup-success-header">
            <span className="og-signup-check">✓</span>
            <div>
              <div className="og-signup-success-title">
                Your API key is ready
              </div>
              <div className="og-signup-success-sub">
                A copy was also sent to <strong>{email}</strong> for safekeeping.
              </div>
            </div>
          </div>
          <div className="og-signup-key-row">
            <code className="og-signup-key">{result?.apiKey}</code>
            <button
              type="button"
              onClick={copyKey}
              className="og-signup-copy"
              aria-label="Copy API key to clipboard"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="og-signup-meta">
            Plan: <strong>{result?.plan}</strong> · Monthly limit:{' '}
            <strong>{result?.limit?.toLocaleString()}</strong> renders
          </div>
        </div>
      )}
      <style>{`
        .og-signup {
          margin: 1.25rem 0 1.75rem;
          padding: 1.5rem;
          border: 1px solid var(--og-border, rgba(255,255,255,0.12));
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
        }
        .og-signup-label {
          display: block;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 0.4rem;
        }
        .og-signup-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .og-signup-input {
          flex: 1 1 240px;
          min-width: 220px;
          padding: 0.75rem 0.9rem;
          border: 1px solid var(--og-border, rgba(255,255,255,0.15));
          border-radius: 8px;
          background: rgba(0,0,0,0.25);
          color: #e2e8f0;
          font: inherit;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .og-signup-input:focus {
          border-color: var(--og-glow, #38ef7d);
          box-shadow: 0 0 0 3px rgba(56,239,125,0.15);
        }
        .og-signup-submit {
          padding: 0.75rem 1.1rem;
          border: 1px solid var(--og-glow, #38ef7d);
          border-radius: 8px;
          background: linear-gradient(135deg, #38ef7d, #11998e);
          color: #06080c;
          font: inherit;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .og-signup-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(56,239,125,0.25);
        }
        .og-signup-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .og-signup-hint {
          margin: 0.6rem 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
        .og-signup-error {
          margin: 0.6rem 0 0;
          padding: 0.6rem 0.8rem;
          border: 1px solid rgba(248,113,113,0.4);
          border-radius: 8px;
          background: rgba(248,113,113,0.08);
          color: #fca5a5;
          font-size: 0.85rem;
        }
        .og-signup-success-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .og-signup-check {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(56,239,125,0.15);
          color: #38ef7d;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .og-signup-success-title {
          font-weight: 700;
          color: #e2e8f0;
        }
        .og-signup-success-sub {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-top: 0.15rem;
        }
        .og-signup-key-row {
          display: flex;
          gap: 0.5rem;
          align-items: stretch;
          margin-bottom: 0.75rem;
        }
        .og-signup-key {
          flex: 1;
          padding: 0.7rem 0.9rem;
          border: 1px solid var(--og-border, rgba(255,255,255,0.15));
          border-radius: 8px;
          background: rgba(0,0,0,0.4);
          color: #38ef7d;
          font-family: var(--sl-font-mono, ui-monospace, monospace);
          font-size: 0.85rem;
          overflow-x: auto;
          white-space: nowrap;
          user-select: all;
        }
        .og-signup-copy {
          padding: 0.7rem 1rem;
          border: 1px solid var(--og-border, rgba(255,255,255,0.15));
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          color: #e2e8f0;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .og-signup-copy:hover {
          border-color: var(--og-glow, #38ef7d);
          background: rgba(56,239,125,0.08);
        }
        .og-signup-meta {
          font-size: 0.82rem;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
