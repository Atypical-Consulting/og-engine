import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number;
  suffix: string;
  label: string;
  detail: string;
}

const STATS: Stat[] = [
  { value: 30, suffix: 'x', label: 'Faster renders', detail: '~22ms vs ~660ms' },
  { value: 50, suffix: 'x', label: 'Less memory', detail: '~10MB vs ~500MB' },
  { value: 100, suffix: 'x', label: 'More concurrency', detail: '500+ vs 5-10/instance' },
  { value: 100, suffix: 'x', label: 'Faster cold start', detail: '~50ms vs ~5s' },
];

function useCountUp(target: number, active: boolean, duration = 1200) {
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

  return (
    <div ref={ref} className="bench-grid">
      {STATS.map((stat, i) => (
        <CounterCard key={stat.label} stat={stat} active={active} delay={i * 150} />
      ))}
    </div>
  );
}

function CounterCard({ stat, active, delay }: { stat: Stat; active: boolean; delay: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  const count = useCountUp(stat.value, started);

  return (
    <div className={`bench-card ${started ? 'bench-card-visible' : ''}`}>
      <div className="bench-value">
        {count}<span className="bench-suffix">{stat.suffix}</span>
      </div>
      <div className="bench-label">{stat.label}</div>
      <div className="bench-detail">{stat.detail}</div>
    </div>
  );
}
