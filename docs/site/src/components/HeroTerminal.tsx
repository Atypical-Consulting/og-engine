import { useState, useEffect } from 'react';

const LINES = [
  { type: 'prompt', text: '$ curl -X POST https://api.og-engine.com/render \\' },
  { type: 'continuation', text: '  -H "Content-Type: application/json" \\' },
  { type: 'continuation', text: '  -d \'{"format":"og","title":"Hello, World"}\' \\' },
  { type: 'continuation', text: '  --output hello.png' },
  { type: 'blank', text: '' },
  { type: 'response', text: '  HTTP/1.1 200 OK' },
  { type: 'header', text: '  Content-Type: image/png' },
  { type: 'header-accent', text: '  X-Render-Time-Ms: 1.87' },
  { type: 'header', text: '  X-Title-Lines: 1' },
  { type: 'header', text: '  X-Layout-Overflow: false' },
  { type: 'blank', text: '' },
  { type: 'success', text: '  ✓ hello.png saved (42.1 KB)' },
];

export default function HeroTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= LINES.length) return;
    const delay = visibleLines === 0 ? 600 : visibleLines === 5 ? 400 : 120;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div className="hero-terminal" role="img" aria-label="Terminal showing OG Engine API request completing in 1.87ms">
      <div className="hero-terminal-bar">
        <div className="hero-terminal-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="hero-terminal-title">og-engine — render</span>
      </div>
      <pre className="hero-terminal-body">
        {LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} className={`term-line term-${line.type}`} style={{ animationDelay: `${i * 0.08}s` }}>
            {line.text}
          </div>
        ))}
        {visibleLines < LINES.length && (
          <span className="term-cursor">▋</span>
        )}
        {visibleLines >= LINES.length && (
          <div className="term-line term-prompt" style={{ animationDelay: '0.1s' }}>
            $ <span className="term-cursor">▋</span>
          </div>
        )}
      </pre>
    </div>
  );
}
