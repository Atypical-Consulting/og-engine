import { runOgBenchmarks } from './run';
import { runPuppeteerBaseline } from './puppeteer-baseline';
import { writeJsonReport, writeMarkdownReport } from './report';
import { getMachineInfo } from './machine-info';

console.log('╔══════════════════════════════════════╗');
console.log('║   OG Engine Benchmark Suite          ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

const machine = getMachineInfo();
console.log(`Machine: ${machine.os} / ${machine.cpu} / ${machine.ram}`);
console.log(`Bun: ${machine.bunVersion} | Node: ${machine.nodeVersion}`);
console.log('');

// Phase 1: OG Engine
console.log('── OG Engine ──');
const ogResults = await runOgBenchmarks();
console.log('');

// Phase 2: Puppeteer
console.log('── Puppeteer Baseline ──');
const puppeteerResults = await runPuppeteerBaseline();
console.log('');

// Phase 3: Reports
console.log('── Generating Reports ──');
const jsonPath = await writeJsonReport(machine, ogResults, puppeteerResults);
const mdPath = await writeMarkdownReport(machine, ogResults, puppeteerResults);
console.log(`  JSON: ${jsonPath}`);
console.log(`  Markdown: ${mdPath}`);
console.log('');

// Summary
const baselineOg = ogResults.find((r) => r.scenario.slug === 'baseline');
const baselinePp = puppeteerResults.find((r) => r.scenarioSlug === 'baseline');
if (baselineOg && baselinePp) {
  const ogP50 = baselineOg.stats.fullPipeline.p50;
  const ppP50 = baselinePp.warm.stats.p50;
  const speedup = (ppP50 / ogP50).toFixed(0);
  console.log('── Summary ──');
  console.log(`  OG Engine:  ${ogP50.toFixed(2)}ms (P50 full pipeline)`);
  console.log(`  Puppeteer:  ${ppP50.toFixed(2)}ms (P50 warm)`);
  console.log(`  Speedup:    ${speedup}x`);
  console.log('');
  console.log(`  Text layout: ${baselineOg.stats.textMeasure.p50.toFixed(3)}ms`);
  console.log(`  Canvas draw: ${baselineOg.stats.canvasDraw.p50.toFixed(3)}ms`);
  console.log(`  PNG encode:  ${baselineOg.stats.pngEncode.p50.toFixed(3)}ms`);
}

console.log('\nDone.');
