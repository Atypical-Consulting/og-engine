/**
 * Records one row per docs page view.
 *
 * Mounted immediately before the static docs handler in src/index.ts, so it
 * only ever sees requests that no API route claimed. It then records only
 * successful HTML GETs — assets, API JSON and 404s are skipped.
 *
 * Set ANALYTICS_ENABLED=false to turn the whole thing off without a deploy of
 * new code; nothing else in the request path depends on it.
 */

import type { MiddlewareHandler } from 'hono';
import {
  classifySource,
  identifyVisitor,
  isAutomatedClient,
  isPrefetch,
  normalisePath,
  referrerHost,
} from '../analytics/identity';
import { getDailySalt, purgeOldAnalytics, recordPageView } from '../db/analytics';

export function analyticsEnabled(): boolean {
  return process.env.ANALYTICS_ENABLED !== 'false';
}

let purgedThisProcess = false;

export function pageViewTracking(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    if (!analyticsEnabled()) return;
    if (c.req.method !== 'GET') return;
    if (c.res.status !== 200) return;
    if (!(c.res.headers.get('Content-Type') ?? '').includes('text/html')) return;
    if (isPrefetch(c)) return;
    if (isAutomatedClient(c.req.header('User-Agent'))) return;

    try {
      if (!purgedThisProcess) {
        purgedThisProcess = true;
        purgeOldAnalytics();
      }

      const salt = getDailySalt();
      const { visitorHash, networkHash } = identifyVisitor(c, salt);
      const url = new URL(c.req.url);
      const refHost = referrerHost(c.req.header('Referer') ?? c.req.header('Referrer'));
      const utmSource = url.searchParams.get('utm_source');

      recordPageView({
        path: normalisePath(url.pathname),
        visitorHash,
        networkHash,
        source: classifySource({ referrerHost: refHost, utmSource, selfHost: url.hostname.replace(/^www\./, '') }),
        referrerHost: refHost,
        utmSource,
        utmMedium: url.searchParams.get('utm_medium'),
        utmCampaign: url.searchParams.get('utm_campaign'),
      });
    } catch (err) {
      // Analytics must never take the docs site down.
      console.error('[analytics] failed to record page view:', err);
    }
  };
}
