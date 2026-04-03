import { registerFonts } from '../src/engine/fonts';
import { renderCard, type RenderOptions } from '../src/engine/renderer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
await registerFonts(join(__dirname, '..', 'fonts'));

const options: RenderOptions = {
  title: 'Server-Side Text Layout Without a Browser',
  description: 'Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images.',
  author: 'OG Engine',
  tag: 'Benchmark',
  format: 'og',
  accent: '#38ef7d',
  layout: 'left',
  titleSize: 48,
  descSize: 22,
  fontName: 'Outfit',
  gradient: 'void',
  bgImageBuffer: null,
  overlayOpacity: 0.65,
};

// Warmup
for (let i = 0; i < 10; i++) {
  renderCard(options);
}

// Benchmark
const iterations = 100;
const times: number[] = [];

for (let i = 0; i < iterations; i++) {
  const t0 = performance.now();
  renderCard(options);
  times.push(performance.now() - t0);
}

times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b) / times.length;
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
const p99 = times[Math.floor(times.length * 0.99)];
const min = times[0];
const max = times[times.length - 1];

console.log(`\nOG Engine Benchmark (${iterations} iterations)`);
console.log('─'.repeat(40));
console.log(`  Min:  ${min.toFixed(2)} ms`);
console.log(`  P50:  ${p50.toFixed(2)} ms`);
console.log(`  P95:  ${p95.toFixed(2)} ms`);
console.log(`  P99:  ${p99.toFixed(2)} ms`);
console.log(`  Max:  ${max.toFixed(2)} ms`);
console.log(`  Avg:  ${avg.toFixed(2)} ms`);
console.log(`  Puppeteer equivalent: ~850ms → ${(850 / avg).toFixed(0)}x speedup`);
