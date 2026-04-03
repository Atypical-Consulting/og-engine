import puppeteer, { type Browser } from 'puppeteer';
import { SCENARIOS, puppeteerHtml } from './scenarios';
import { computeStats, formatMs, type Stats } from './stats';

const WARMUP = 5;
const ITERATIONS = 50;

export interface PuppeteerResult {
  scenarioSlug: string;
  scenarioName: string;
  warm: { raw: number[]; stats: Stats };
  cold: { raw: number[]; stats: Stats };
}

async function runWarm(browser: Browser, html: string, iterations: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ type: 'png' });
    await page.close();
    times.push(performance.now() - t0);
  }
  return times;
}

async function runCold(html: string, iterations: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ type: 'png' });
    await page.close();
    await browser.close();
    times.push(performance.now() - t0);
  }
  return times;
}

export async function runPuppeteerBaseline(): Promise<PuppeteerResult[]> {
  const results: PuppeteerResult[] = [];

  const scenarios = SCENARIOS.filter((s) => s.slug === 'baseline' || s.slug === 'long-text');

  for (const scenario of scenarios) {
    const html = puppeteerHtml(scenario.options.title, scenario.options.description);

    // Warm: reuse browser
    process.stdout.write(`  ${scenario.name} (warm)...`);
    const browser = await puppeteer.launch({ headless: true });

    // Warmup
    for (let i = 0; i < WARMUP; i++) {
      const p = await browser.newPage();
      await p.setViewport({ width: 1200, height: 630 });
      await p.setContent(html, { waitUntil: 'load' });
      await p.screenshot({ type: 'png' });
      await p.close();
    }

    const warmTimes = await runWarm(browser, html, ITERATIONS);
    await browser.close();
    console.log(` ${formatMs(computeStats(warmTimes).p50)} (P50)`);

    // Cold: fresh browser each time (only 10 iterations)
    process.stdout.write(`  ${scenario.name} (cold)...`);
    const coldTimes = await runCold(html, 10);
    console.log(` ${formatMs(computeStats(coldTimes).p50)} (P50)`);

    results.push({
      scenarioSlug: scenario.slug,
      scenarioName: scenario.name,
      warm: { raw: warmTimes, stats: computeStats(warmTimes) },
      cold: { raw: coldTimes, stats: computeStats(coldTimes) },
    });
  }

  return results;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\nPuppeteer Baseline Benchmark\n');
  const results = await runPuppeteerBaseline();

  console.log('\n--- Results ---\n');
  for (const r of results) {
    console.log(`${r.scenarioName}`);
    console.log(`  Warm: ${formatMs(r.warm.stats.p50)} (P50)  ${formatMs(r.warm.stats.p95)} (P95)`);
    console.log(`  Cold: ${formatMs(r.cold.stats.p50)} (P50)  ${formatMs(r.cold.stats.p95)} (P95)`);
    console.log('');
  }
}
