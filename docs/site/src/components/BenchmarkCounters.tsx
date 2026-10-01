import { useEffect, useRef, useState } from 'react';

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return count;
}

export default function BenchmarkCounters() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heroNumber = useCountUp(30, active);

  return (
    <div ref={ref} className="bench-hero not-content">
      {/* One big hero number */}
      <div className={`bench-hero-number ${active ? 'bench-hero-visible' : ''}`}>
        <div className="bench-hero-value">
          {heroNumber}<span className="bench-hero-suffix">x</span>
        </div>
        <div className="bench-hero-label">faster than cold-start headless Chrome</div>
      </div>

      {/* Side-by-side comparison */}
      <div className={`bench-comparison ${active ? 'bench-comparison-visible' : ''}`}>
        <div className="bench-side bench-side-puppeteer">
          <div className="bench-side-header">
            <span className="bench-side-icon">&#x1F4A4;</span>
            <span className="bench-side-name">Puppeteer</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Render, warm</span>
            <span className="bench-row-value bench-row-slow">~129ms</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Render, cold</span>
            <span className="bench-row-value bench-row-slow">~658ms</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Memory</span>
            <span className="bench-row-value bench-row-slow">~500MB</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Concurrency</span>
            <span className="bench-row-value bench-row-slow">5-10</span>
          </div>
        </div>

        <div className="bench-vs">vs</div>

        <div className="bench-side bench-side-engine">
          <div className="bench-side-header">
            <span className="bench-side-icon">&#x26A1;</span>
            <span className="bench-side-name">OG Engine</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Render, warm</span>
            <span className="bench-row-value bench-row-fast">~22ms</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Render, cold</span>
            <span className="bench-row-value bench-row-fast">no browser to launch</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Memory</span>
            <span className="bench-row-value bench-row-fast">~10MB</span>
          </div>
          <div className="bench-row">
            <span className="bench-row-label">Concurrency</span>
            <span className="bench-row-value bench-row-fast">500+</span>
          </div>
        </div>
      </div>

      <p className="bench-footnote">
        og-engine and Puppeteer measured in the same <code>bun run bench:full</code> on an Apple M2, 24&nbsp;GB &middot; <a href="/benchmarks/">Full methodology &rarr;</a>
      </p>
    </div>
  );
}
