import { registerFonts } from '../src/engine/fonts';
import { renderCard } from '../src/engine/renderer';
import { SCENARIOS, type Scenario } from './scenarios';
import { computeStats, formatMs, type Stats } from './stats';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'fonts');

const WARMUP = 50;
const ITERATIONS = 1000;

export interface PhaseResults {
  textMeasure: number[];
  canvasDraw: number[];
  pngEncode: number[];
  fullPipeline: number[];
}

export interface ScenarioResult {
  scenario: Scenario;
  raw: PhaseResults;
  stats: {
    textMeasure: Stats;
    canvasDraw: Stats;
    pngEncode: Stats;
    fullPipeline: Stats;
  };
}

function runScenario(scenario: Scenario): ScenarioResult {
  const opts = { ...scenario.options, timing: true };

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    renderCard(opts);
  }

  const raw: PhaseResults = {
    textMeasure: [],
    canvasDraw: [],
    pngEncode: [],
    fullPipeline: [],
  };

  for (let i = 0; i < ITERATIONS; i++) {
    const result = renderCard(opts);
    const p = result.phases!;
    raw.textMeasure.push(p.textMeasureMs);
    raw.canvasDraw.push(p.canvasDrawMs);
    raw.pngEncode.push(p.pngEncodeMs);
    raw.fullPipeline.push(p.totalMs);
  }

  return {
    scenario,
    raw,
    stats: {
      textMeasure: computeStats(raw.textMeasure),
      canvasDraw: computeStats(raw.canvasDraw),
      pngEncode: computeStats(raw.pngEncode),
      fullPipeline: computeStats(raw.fullPipeline),
    },
  };
}

export async function runOgBenchmarks(): Promise<ScenarioResult[]> {
  await registerFonts(FONTS_DIR);

  const results: ScenarioResult[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name}...`);
    const result = runScenario(scenario);
    const p50 = result.stats.fullPipeline.p50;
    console.log(` ${formatMs(p50)} (P50)`);
    results.push(result);
  }

  return results;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`\nOG Engine Benchmark (${ITERATIONS} iterations, ${WARMUP} warmup)\n`);
  const results = await runOgBenchmarks();

  console.log('\n--- Detailed Results ---\n');
  for (const r of results) {
    console.log(`${r.scenario.name}`);
    console.log(`  Text measure:  ${formatMs(r.stats.textMeasure.p50)} (P50)  ${formatMs(r.stats.textMeasure.p95)} (P95)`);
    console.log(`  Canvas draw:   ${formatMs(r.stats.canvasDraw.p50)} (P50)  ${formatMs(r.stats.canvasDraw.p95)} (P95)`);
    console.log(`  PNG encode:    ${formatMs(r.stats.pngEncode.p50)} (P50)  ${formatMs(r.stats.pngEncode.p95)} (P95)`);
    console.log(`  Full pipeline: ${formatMs(r.stats.fullPipeline.p50)} (P50)  ${formatMs(r.stats.fullPipeline.p95)} (P95)`);
    console.log('');
  }
}
