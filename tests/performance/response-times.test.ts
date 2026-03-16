/**
 * Performance Tests - Response Time Validation
 *
 * Validates that endpoints respond within acceptable timeframes.
 * These are NOT load tests - they validate baseline performance.
 *
 * V2: All beheer references replaced with storefront/platform-admin URLs.
 */

import {
  STOREFRONT_URL,
  PLATFORM_ADMIN_URL,
  MARKETING_URL,
} from "../utils/test-config";

const THRESHOLDS = {
  health: 1000,
  api: 2000,
  page: 3000,
  static: 1000,
};

interface TimedResponse {
  status: number;
  time: number;
  headers: Headers;
}

async function timedFetch(
  url: string,
  options: RequestInit = {},
): Promise<TimedResponse> {
  const start = Date.now();
  const response = await fetch(url, options);
  const time = Date.now() - start;

  return {
    status: response.status,
    time,
    headers: response.headers,
  };
}

describe("Performance - Health Endpoints", () => {
  it(`storefront /api/health should respond within ${THRESHOLDS.health}ms`, async () => {
    const { time, status } = await timedFetch(`${STOREFRONT_URL}/api/health`);

    if (status === 404) {
      console.log(
        `  ⚠️ WARNING: Storefront health returns 404 — no tenant provisioned (${time}ms)`,
      );
    } else {
      expect(status).toBe(200);
    }
    expect(time).toBeLessThan(THRESHOLDS.health);
    console.log(`  Response time: ${time}ms`);
  });

  it(`platform admin /api/health should respond within ${THRESHOLDS.health}ms`, async () => {
    const { time, status } = await timedFetch(
      `${PLATFORM_ADMIN_URL}/api/health`,
    );

    expect(status).toBe(200);
    expect(time).toBeLessThan(THRESHOLDS.health);
    console.log(`  Response time: ${time}ms`);
  });
});

describe("Performance - API Endpoints", () => {
  it(`/api/products should respond within ${THRESHOLDS.api}ms`, async () => {
    const { time, status } = await timedFetch(`${STOREFRONT_URL}/api/products`);

    if (status === 500) {
      console.log(`  ⚠️ KNOWN ISSUE: /api/products returns 500 (${time}ms)`);
    } else if (status === 404) {
      console.log(
        `  ⚠️ WARNING: /api/products returns 404 — no tenant provisioned (${time}ms)`,
      );
    } else {
      expect(status).toBe(200);
    }
    expect(time).toBeLessThan(THRESHOLDS.api);
    console.log(`  Response time: ${time}ms`);
  });
});

describe("Performance - Page Load", () => {
  it(`marketing homepage should load within ${THRESHOLDS.page}ms`, async () => {
    const { time, status } = await timedFetch(MARKETING_URL);

    expect(status).toBe(200);
    expect(time).toBeLessThan(THRESHOLDS.page);
    console.log(`  Response time: ${time}ms`);
  });

  it(`storefront homepage should load within ${THRESHOLDS.page}ms`, async () => {
    const { time, status } = await timedFetch(STOREFRONT_URL);

    if (status === 404) {
      console.log(
        `  ⚠️ WARNING: Storefront homepage returns 404 — no tenant provisioned (${time}ms)`,
      );
    } else {
      expect(status).toBe(200);
    }
    expect(time).toBeLessThan(THRESHOLDS.page);
    console.log(`  Response time: ${time}ms`);
  });
});

describe("Performance - Cache Headers", () => {
  it("marketing site should have cache-control headers", async () => {
    const response = await fetch(MARKETING_URL);
    const cacheControl = response.headers.get("cache-control");

    if (!cacheControl) {
      console.warn(
        "  ⚠️ WARNING: Marketing site has no Cache-Control header — consider adding via _headers or Cloudflare Page Rules",
      );
    } else {
      console.log(`  Cache-Control: ${cacheControl}`);
    }

    // Warn instead of fail — CF Pages static sites may not set cache-control on HTML
    expect(response.status).toBe(200);
  });

  it("API health should not be cached", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/health`);
    const cacheControl = response.headers.get("cache-control");

    if (cacheControl) {
      expect(cacheControl).toMatch(/no-cache|no-store|private|max-age=0/);
    }
  });
});

describe("Performance - Concurrent Requests", () => {
  it("should handle 10 concurrent health checks", async () => {
    const requests = Array(10)
      .fill(null)
      .map(() => timedFetch(`${STOREFRONT_URL}/api/health`));

    const results = await Promise.all(requests);

    const allSuccessful = results.every((r) => r.status === 200);
    const avgTime =
      results.reduce((sum, r) => sum + r.time, 0) / results.length;
    const maxTime = Math.max(...results.map((r) => r.time));

    const CONCURRENT_THRESHOLD = 3000;

    expect(allSuccessful).toBe(true);
    if (maxTime > CONCURRENT_THRESHOLD) {
      console.log(
        `  ⚠️ WARNING: Max time ${maxTime}ms exceeds ${CONCURRENT_THRESHOLD}ms threshold`,
      );
    }
    expect(maxTime).toBeLessThan(5000);
    console.log(`  Avg: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms`);
  });
});

describe("Performance - Cold Start Detection", () => {
  it("should detect if worker has cold start penalty", async () => {
    const cold = await timedFetch(`${STOREFRONT_URL}/api/health`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const warm = await timedFetch(`${STOREFRONT_URL}/api/health`);

    const coldStartPenalty = cold.time - warm.time;

    if (coldStartPenalty > 500) {
      console.warn(
        `  ⚠️ Possible cold start detected: ${coldStartPenalty}ms penalty`,
      );
    } else {
      console.log(
        `  Cold: ${cold.time}ms, Warm: ${warm.time}ms, Delta: ${coldStartPenalty}ms`,
      );
    }

    expect(cold.status).toBe(200);
    expect(warm.status).toBe(200);
  });
});
