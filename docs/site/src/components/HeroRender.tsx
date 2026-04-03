import { useState, useEffect, useRef } from 'react';

// ─── Typewriter for the JSON request ───
const REQUEST_LINES = [
  '  curl -X POST /render \\',
  '    -d \'{',
  '      "format": "og",',
  '      "title": "Hello, World",',
  '      "style": { "accent": "#38ef7d" }',
  '    }\'',
];

// ─── Response headers ───
const RESPONSE_LINES = [
  { text: 'HTTP/1.1 200 OK', cls: 'hr-resp' },
  { text: 'Content-Type: image/png', cls: 'hr-header' },
  { text: 'X-Render-Time-Ms: 1.87', cls: 'hr-accent' },
  { text: 'X-Layout-Overflow: false', cls: 'hr-header' },
];

function useAnimatedNumber(target: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(eased * target);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, start]);

  return value;
}

export default function HeroRender() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'idle' | 'typing' | 'sending' | 'response' | 'image' | 'done'>('idle');
  const [typedLines, setTypedLines] = useState(0);
  const [responseLines, setResponseLines] = useState(0);
  const [imageRevealed, setImageRevealed] = useState(false);
  const renderTime = useAnimatedNumber(1.87, 600, phase === 'response' || phase === 'image' || phase === 'done');

  // Start animation when element is visible in viewport
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setPhase('typing'), 400);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Type request lines
  useEffect(() => {
    if (phase !== 'typing') return;
    if (typedLines >= REQUEST_LINES.length) {
      const t = setTimeout(() => setPhase('sending'), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTypedLines(l => l + 1), 90);
    return () => clearTimeout(t);
  }, [phase, typedLines]);

  // Sending flash
  useEffect(() => {
    if (phase !== 'sending') return;
    const t = setTimeout(() => setPhase('response'), 500);
    return () => clearTimeout(t);
  }, [phase]);

  // Response lines
  useEffect(() => {
    if (phase !== 'response') return;
    if (responseLines >= RESPONSE_LINES.length) {
      const t = setTimeout(() => setPhase('image'), 200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setResponseLines(l => l + 1), 80);
    return () => clearTimeout(t);
  }, [phase, responseLines]);

  // Image reveal
  useEffect(() => {
    if (phase !== 'image') return;
    const t = setTimeout(() => {
      setImageRevealed(true);
      setPhase('done');
    }, 100);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="hr-root" ref={rootRef}>
      {/* ─── Render time centerpiece ─── */}
      <div className={`hr-stat ${phase === 'response' || phase === 'image' || phase === 'done' ? 'hr-stat-visible' : ''}`}>
        <div className="hr-stat-value">
          {renderTime.toFixed(2)}
          <span className="hr-stat-unit">ms</span>
        </div>
        <div className="hr-stat-label">render time</div>
      </div>

      {/* ─── Split panel ─── */}
      <div className="hr-panels">
        {/* Left: Request */}
        <div className="hr-panel hr-panel-request">
          <div className="hr-panel-bar">
            <div className="hr-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="hr-panel-label">request</span>
            {phase === 'sending' && <span className="hr-sending-indicator" />}
          </div>
          <pre className="hr-code">
            <code>
              <span className="hr-prompt">$</span>{' '}
              {REQUEST_LINES.slice(0, typedLines).map((line, i) => (
                <div key={i} className="hr-line hr-line-in">
                  {line}
                </div>
              ))}
              {phase === 'typing' && <span className="hr-cursor">|</span>}
              {(phase === 'response' || phase === 'image' || phase === 'done') && (
                <>
                  <div className="hr-divider" />
                  {RESPONSE_LINES.slice(0, responseLines).map((line, i) => (
                    <div key={`r-${i}`} className={`hr-line hr-line-in ${line.cls}`}>
                      {line.text}
                    </div>
                  ))}
                </>
              )}
              {phase === 'done' && (
                <div className="hr-line hr-line-in hr-success">
                  {'\u2713'} hello.png saved (42.1 KB)
                </div>
              )}
            </code>
          </pre>
        </div>

        {/* Right: Output */}
        <div className="hr-panel hr-panel-output">
          <div className="hr-panel-bar">
            <span className="hr-panel-label">output</span>
            {phase === 'done' && <span className="hr-panel-badge">PNG 1200x630</span>}
          </div>
          <div className="hr-preview-area">
            {phase === 'idle' || phase === 'typing' ? (
              <div className="hr-placeholder">
                <div className="hr-placeholder-lines">
                  <div className="hr-ph-line hr-ph-long" />
                  <div className="hr-ph-line hr-ph-short" />
                  <div className="hr-ph-line hr-ph-med" />
                </div>
                <span className="hr-placeholder-text">awaiting render...</span>
              </div>
            ) : phase === 'sending' ? (
              <div className="hr-placeholder hr-placeholder-pulse">
                <div className="hr-spinner" />
                <span className="hr-placeholder-text">rendering...</span>
              </div>
            ) : (
              <div className={`hr-card-preview ${imageRevealed ? 'hr-card-revealed' : 'hr-card-materializing'}`}>
                <div className="hr-card-inner">
                  <div className="hr-card-accent" />
                  <div className="hr-card-tag">Open Source</div>
                  <div className="hr-card-title">Hello, World</div>
                  <div className="hr-card-desc">
                    Server-side image generation — no browser required.
                  </div>
                  <div className="hr-card-footer">og-engine.com</div>
                </div>
                <div className="hr-card-scanlines" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom stats strip ─── */}
      <div className={`hr-metrics ${phase === 'done' ? 'hr-metrics-visible' : ''}`}>
        <div className="hr-metric">
          <span className="hr-metric-value">0</span>
          <span className="hr-metric-label">browser deps</span>
        </div>
        <div className="hr-metric-sep" />
        <div className="hr-metric">
          <span className="hr-metric-value">~10</span>
          <span className="hr-metric-unit">MB</span>
          <span className="hr-metric-label">memory</span>
        </div>
        <div className="hr-metric-sep" />
        <div className="hr-metric">
          <span className="hr-metric-value">500+</span>
          <span className="hr-metric-label">concurrent</span>
        </div>
        <div className="hr-metric-sep" />
        <div className="hr-metric">
          <span className="hr-metric-value">30x</span>
          <span className="hr-metric-label">vs Puppeteer</span>
        </div>
      </div>
    </div>
  );
}
