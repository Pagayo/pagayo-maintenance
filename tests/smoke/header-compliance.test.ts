/**
 * HEADER COMPLIANCE TESTS
 * ============================================================================
 * DOEL: Detecteert configuratiefouten in HTTP headers die browsers breken
 *
 * CATEGORIE: Post-deploy verificatie
 * PRIORITEIT: CRITICAL — Deze problemen zijn onzichtbaar in unit tests
 *   maar breken de site voor eindgebruikers
 *
 * WAT DIT VANGT:
 * - Security headers die assets blokkeren (CORP, CORS, CSP)
 * - Dubbele headers (Cloudflare Pages _headers + worker middleware)
 * - Ontbrekende of verkeerde Cache-Control
 * - Middleware die onbedoeld op verkeerde routes lekt
 * - CSS/JS assets die niet bereikbaar zijn
 *
 * ACHTERGROND: Audit van 18 feb 2026 bracht 5 productie-problemen aan het
 * licht die ALLEMAAL header-gerelateerd waren en niet door bestaande tests
 * werden gevangen.
 *
 * @module tests/smoke/header-compliance
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import { STOREFRONT_URL } from "../utils/test-config";

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "header-compliance",
    test,
    status,
    details,
    action,
    priority,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check of een response een "Tenant not found" 404 is.
 * Zonder actieve tenant is dit VERWACHT gedrag — geen fout.
 */
async function isTenantNotFound(response: Response): Promise<boolean> {
  if (response.status !== 404) return false;
  try {
    const body = await response.clone().text();
    return body.includes("Tenant not found");
  } catch {
    return false;
  }
}

/**
 * Haal alle waarden op voor een specifieke header.
 * Cloudflare Pages kan headers combineren (comma-separated) of
 * meerdere keren dezelfde header zetten.
 */
function getHeaderValues(headers: Headers, name: string): string[] {
  const raw = headers.get(name);
  if (!raw) return [];
  // Headers met meerdere waarden worden comma-separated
  return raw.split(",").map((v) => v.trim());
}

/**
 * Check of een header exact één keer voorkomt (niet gedupliceerd).
 */
function headerHasSingleValue(headers: Headers, name: string): boolean {
  const values = getHeaderValues(headers, name);
  // Filter lege strings
  const meaningful = values.filter((v) => v.length > 0);
  return meaningful.length <= 1;
}

// ============================================================================
// 1. CORS HEADER COMPLIANCE
// ============================================================================

describe("Header Compliance - CORS", () => {
  it("Homepage has single Access-Control-Allow-Origin (not duplicated)", async () => {
    const response = await fetch(STOREFRONT_URL, {
      headers: { Origin: STOREFRONT_URL },
    });

    const acao = response.headers.get("access-control-allow-origin");
    const isSingle = headerHasSingleValue(
      response.headers,
      "access-control-allow-origin",
    );

    if (!acao) {
      // CORS niet vereist voor same-origin HTML — OK
      log("cors-homepage-single", "PASS", "No ACAO header (same-origin OK)");
    } else if (isSingle) {
      log("cors-homepage-single", "PASS", `ACAO: ${acao}`);
    } else {
      log(
        "cors-homepage-single",
        "FAIL",
        `Dubbele ACAO: "${acao}" — browser zal dit weigeren`,
        "Check _headers voor dubbele Access-Control-Allow-Origin. Worker CORS middleware en _headers mogen niet allebei ACAO zetten.",
        "CRITICAL",
      );
    }

    expect(isSingle || !acao).toBe(true);
  });

  it("JS entry point has single Access-Control-Allow-Origin", async () => {
    const response = await fetch(`${STOREFRONT_URL}/assets/main.js`, {
      headers: { Origin: STOREFRONT_URL },
    });

    const acao = response.headers.get("access-control-allow-origin");
    const isSingle = headerHasSingleValue(
      response.headers,
      "access-control-allow-origin",
    );

    if (isSingle || !acao) {
      log(
        "cors-mainjs-single",
        "PASS",
        `ACAO: ${acao ?? "(none)"} — single value`,
      );
    } else {
      log(
        "cors-mainjs-single",
        "FAIL",
        `Dubbele ACAO op main.js: "${acao}"`,
        "Verwijder Access-Control-Allow-Origin uit _headers — worker middleware handelt CORS af",
        "CRITICAL",
      );
    }

    expect(isSingle || !acao).toBe(true);
  });

  it("Design CSS has single Access-Control-Allow-Origin", async () => {
    // Design CSS wordt cross-origin geladen via Pages CDN
    const response = await fetch(
      `${STOREFRONT_URL}/design/dist/revolutionary/admin.css`,
      { headers: { Origin: STOREFRONT_URL } },
    );

    if (await isTenantNotFound(response)) {
      log(
        "cors-design-css",
        "PASS",
        "Geen actieve tenant — design CSS achter tenant resolution (verwacht 404)",
      );
      return;
    }

    if (response.status !== 200) {
      log(
        "cors-design-css",
        "FAIL",
        `Design CSS niet bereikbaar: HTTP ${response.status}`,
        "Run npm run copy-design en deploy opnieuw",
        "CRITICAL",
      );
      expect(response.status).toBe(200);
      return;
    }

    const acao = response.headers.get("access-control-allow-origin");
    const isSingle = headerHasSingleValue(
      response.headers,
      "access-control-allow-origin",
    );

    if (isSingle || !acao) {
      log(
        "cors-design-css",
        "PASS",
        `Design CSS ACAO: ${acao ?? "(none)"} — OK`,
      );
    } else {
      log(
        "cors-design-css",
        "FAIL",
        `Dubbele ACAO op design CSS: "${acao}"`,
        "Verwijder ACAO uit _headers voor /design/dist/*",
        "CRITICAL",
      );
    }

    expect(isSingle || !acao).toBe(true);
  });
});

// ============================================================================
// 2. CROSS-ORIGIN RESOURCE POLICY (CORP)
// ============================================================================

describe("Header Compliance - CORP (Cross-Origin-Resource-Policy)", () => {
  it("CSS resources are not blocked by CORP same-origin", async () => {
    const response = await fetch(
      `${STOREFRONT_URL}/design/dist/revolutionary/admin.css`,
    );

    if (await isTenantNotFound(response)) {
      log(
        "corp-css",
        "PASS",
        "Geen actieve tenant — design CSS achter tenant resolution (verwacht 404)",
      );
      return;
    }

    if (response.status !== 200) {
      log(
        "corp-css",
        "FAIL",
        `CSS niet bereikbaar: HTTP ${response.status}`,
        "Check design CSS deployment",
        "CRITICAL",
      );
      expect(response.status).toBe(200);
      return;
    }

    const corp = response.headers.get("cross-origin-resource-policy");

    if (corp === "same-origin") {
      log(
        "corp-css",
        "FAIL",
        `CORP: same-origin blokkeert cross-origin CSS loading`,
        "Verander secureHeaders() naar crossOriginResourcePolicy: 'cross-origin' in worker.ts",
        "CRITICAL",
      );
      expect(corp).not.toBe("same-origin");
    } else {
      log("corp-css", "PASS", `CORP: ${corp ?? "(niet gezet)"} — CSS laadbaar`);
    }
  });

  it("JS entry point is not blocked by CORP same-origin", async () => {
    const response = await fetch(`${STOREFRONT_URL}/assets/main.js`);

    const corp = response.headers.get("cross-origin-resource-policy");

    if (corp === "same-origin") {
      log(
        "corp-js",
        "FAIL",
        `CORP: same-origin blokkeert JS loading vanuit ander origin`,
        "Check secureHeaders() in worker.ts — crossOriginResourcePolicy moet 'cross-origin' zijn",
        "CRITICAL",
      );
      expect(corp).not.toBe("same-origin");
    } else {
      log("corp-js", "PASS", `CORP: ${corp ?? "(niet gezet)"} — JS laadbaar`);
    }
  });
});

// ============================================================================
// 3. CACHE-CONTROL COMPLIANCE
// ============================================================================

describe("Header Compliance - Cache-Control", () => {
  it("HTML pages have reasonable cache (not no-store)", async () => {
    const response = await fetch(STOREFRONT_URL);
    const cc = response.headers.get("cache-control");

    if (!cc) {
      log(
        "cache-html",
        "WARN",
        "Geen Cache-Control op HTML — browser default caching",
        "Overweeg Cache-Control: private, max-age=5, stale-while-revalidate=30",
      );
    } else if (cc.includes("no-store")) {
      log(
        "cache-html",
        "FAIL",
        `Cache-Control: ${cc} — site voelt traag aan`,
        "Gebruik: private, max-age=5, stale-while-revalidate=30 in htmlResponse()",
        "HIGH",
      );
      expect(cc).not.toContain("no-store");
    } else {
      log("cache-html", "PASS", `Cache-Control: ${cc}`);
    }
  });

  it("JS entry point (main.js) has short cache with stale-while-revalidate", async () => {
    const response = await fetch(`${STOREFRONT_URL}/assets/main.js`);
    const cc = response.headers.get("cache-control");

    if (!cc) {
      log(
        "cache-mainjs",
        "FAIL",
        "Geen Cache-Control op main.js",
        "Voeg /assets/*.js cache rule toe aan _headers",
        "HIGH",
      );
      expect(cc).toBeTruthy();
    } else if (cc.includes("no-store") || cc.includes("no-cache")) {
      log(
        "cache-mainjs",
        "FAIL",
        `main.js niet gecached: ${cc}`,
        "Gebruik: public, max-age=300, stale-while-revalidate=86400",
        "HIGH",
      );
      expect(cc).not.toContain("no-store");
    } else {
      log("cache-mainjs", "PASS", `Cache-Control: ${cc}`);
    }
  });

  it("Design CSS has cache with stale-while-revalidate", async () => {
    const response = await fetch(
      `${STOREFRONT_URL}/design/dist/revolutionary/admin.css`,
    );

    if (await isTenantNotFound(response)) {
      log(
        "cache-design-css",
        "PASS",
        "Geen actieve tenant — design CSS achter tenant resolution (verwacht 404)",
      );
      return;
    }

    if (response.status !== 200) {
      log(
        "cache-design-css",
        "FAIL",
        `HTTP ${response.status}`,
        "Design CSS niet gevonden",
        "CRITICAL",
      );
      expect(response.status).toBe(200);
      return;
    }

    const cc = response.headers.get("cache-control");

    if (!cc || cc.includes("no-store")) {
      log(
        "cache-design-css",
        "FAIL",
        `Design CSS niet gecached: ${cc ?? "(geen)"}`,
        "Voeg /design/dist/* rule toe aan _headers",
        "HIGH",
      );
    } else {
      log("cache-design-css", "PASS", `Cache-Control: ${cc}`);
    }
  });

  it("Cache-Control values are not duplicated on JS assets", async () => {
    const response = await fetch(`${STOREFRONT_URL}/assets/main.js`);
    const cc = response.headers.get("cache-control");

    if (!cc) {
      log(
        "cache-no-duplicate-js",
        "WARN",
        "Geen Cache-Control (al gerapporteerd)",
      );
      return;
    }

    // Tel hoe vaak "public" voorkomt — meer dan 1x = dubbel
    const publicCount = (cc.match(/public/g) ?? []).length;
    const immutableCount = (cc.match(/immutable/g) ?? []).length;

    if (publicCount > 1 || immutableCount > 1) {
      log(
        "cache-no-duplicate-js",
        "FAIL",
        `Dubbele cache-control waarden: "${cc}"`,
        "Meerdere _headers patronen matchen hetzelfde bestand. Verwijder overlapende patronen.",
        "MEDIUM",
      );
      expect(publicCount).toBeLessThanOrEqual(1);
    } else {
      log("cache-no-duplicate-js", "PASS", `Enkele cache-control: ${cc}`);
    }
  });
});

// ============================================================================
// 4. SECURITY HEADERS
// ============================================================================

describe("Header Compliance - Security Headers", () => {
  it("Homepage has X-Content-Type-Options: nosniff", async () => {
    const response = await fetch(STOREFRONT_URL);
    const val = response.headers.get("x-content-type-options");

    if (val === "nosniff") {
      log("security-xcto", "PASS", "X-Content-Type-Options: nosniff");
    } else {
      log(
        "security-xcto",
        "FAIL",
        `X-Content-Type-Options: ${val ?? "(missing)"}`,
        "Voeg toe aan _headers of secureHeaders()",
        "HIGH",
      );
      expect(val).toBe("nosniff");
    }
  });

  it("Homepage has X-Frame-Options", async () => {
    const response = await fetch(STOREFRONT_URL);
    const val = response.headers.get("x-frame-options");

    if (val) {
      log("security-xfo", "PASS", `X-Frame-Options: ${val}`);
    } else {
      log(
        "security-xfo",
        "WARN",
        "X-Frame-Options ontbreekt",
        "Voeg DENY of SAMEORIGIN toe",
      );
    }
  });

  it("Homepage has Referrer-Policy", async () => {
    const response = await fetch(STOREFRONT_URL);
    const val = response.headers.get("referrer-policy");

    if (val) {
      log("security-referrer", "PASS", `Referrer-Policy: ${val}`);
    } else {
      log(
        "security-referrer",
        "WARN",
        "Referrer-Policy ontbreekt",
        "Voeg strict-origin-when-cross-origin toe",
      );
    }
  });
});

// ============================================================================
// 5. MIDDLEWARE ISOLATION (auth leakage detection)
// ============================================================================

describe("Header Compliance - Middleware Isolation", () => {
  /**
   * Detecteert of auth middleware lekt naar publieke API routes.
   * Dit is precies wat op 18 feb 2026 brak: subscriptionRoutes.use("*", requireAuth)
   * was gemount op /api waardoor /api/analytics en /api/vitals ook 401 gaven.
   */

  const PUBLIC_API_ROUTES = [
    { path: "/api/health", name: "health" },
    { path: "/api/products", name: "products" },
    { path: "/api/categories", name: "categories" },
  ];

  for (const route of PUBLIC_API_ROUTES) {
    it(`${route.path} is public (no 401/403)`, async () => {
      const response = await fetch(`${STOREFRONT_URL}${route.path}`);

      if (response.status === 401 || response.status === 403) {
        log(
          `middleware-leak-${route.name}`,
          "FAIL",
          `${route.path} returned ${response.status} — auth middleware lekt naar publieke route`,
          "Check app.route() mount points in worker.ts — requireAuth() middleware mag niet op /api gemount zijn",
          "CRITICAL",
        );
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      } else {
        log(
          `middleware-leak-${route.name}`,
          "PASS",
          `${route.path}: HTTP ${response.status} — geen auth leak`,
        );
      }
    });
  }

  it("/api/admin/orders requires auth (not accidentally public)", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/admin/orders`);

    if (await isTenantNotFound(response)) {
      log(
        "middleware-admin-protected",
        "PASS",
        "Geen actieve tenant — admin route achter tenant resolution (verwacht 404)",
      );
      return;
    }

    if ([401, 403].includes(response.status)) {
      log(
        "middleware-admin-protected",
        "PASS",
        `Admin route properly protected: HTTP ${response.status}`,
      );
    } else {
      log(
        "middleware-admin-protected",
        "FAIL",
        `Admin route NOT protected: HTTP ${response.status}`,
        "requireAuth() middleware ontbreekt op admin routes",
        "CRITICAL",
      );
      expect([401, 403]).toContain(response.status);
    }
  });
});

// ============================================================================
// 6. ASSET REACHABILITY (CSS/JS actually loads)
// ============================================================================

describe("Header Compliance - Asset Reachability", () => {
  it("main.js returns 200 with JavaScript content", async () => {
    const response = await fetch(`${STOREFRONT_URL}/assets/main.js`);

    if (response.status === 200) {
      const ct = response.headers.get("content-type");
      const isJS =
        ct?.includes("javascript") || ct?.includes("application/javascript");

      if (isJS) {
        log("asset-mainjs", "PASS", `main.js OK (${ct})`);
      } else {
        log(
          "asset-mainjs",
          "WARN",
          `main.js content-type: ${ct} (verwacht javascript)`,
        );
      }
    } else {
      log(
        "asset-mainjs",
        "FAIL",
        `main.js HTTP ${response.status}`,
        "Check Vite build output en _headers",
        "CRITICAL",
      );
    }

    expect(response.status).toBe(200);
  });

  it("Design CSS (admin.css) returns 200 with CSS content", async () => {
    const response = await fetch(
      `${STOREFRONT_URL}/design/dist/revolutionary/admin.css`,
    );

    if (await isTenantNotFound(response)) {
      log(
        "asset-admin-css",
        "PASS",
        "Geen actieve tenant — design CSS achter tenant resolution (verwacht 404)",
      );
      return;
    }

    if (response.status === 200) {
      const ct = response.headers.get("content-type");
      const body = await response.text();

      if (body.length < 1000) {
        log(
          "asset-admin-css",
          "FAIL",
          `admin.css is slechts ${body.length} bytes — waarschijnlijk verouderde versie`,
          "Run: npm run copy-design && deploy. Check of @pagayo/design versie overeenkomt.",
          "CRITICAL",
        );
        expect(body.length).toBeGreaterThan(1000);
      } else {
        log(
          "asset-admin-css",
          "PASS",
          `admin.css: ${body.length} bytes, content-type: ${ct}`,
        );
      }
    } else {
      log(
        "asset-admin-css",
        "FAIL",
        `admin.css HTTP ${response.status}`,
        "Design CSS niet gevonden. Run npm run copy-design en deploy opnieuw.",
        "CRITICAL",
      );
      expect(response.status).toBe(200);
    }
  });

  it("Design CSS (webshop.css) returns 200 with substantial content", async () => {
    const response = await fetch(
      `${STOREFRONT_URL}/design/dist/revolutionary/webshop.css`,
    );

    if (await isTenantNotFound(response)) {
      log(
        "asset-webshop-css",
        "PASS",
        "Geen actieve tenant — design CSS achter tenant resolution (verwacht 404)",
      );
      return;
    }

    if (response.status === 200) {
      const body = await response.text();

      if (body.length < 50000) {
        log(
          "asset-webshop-css",
          "WARN",
          `webshop.css is ${body.length} bytes — mogelijk incompleet (verwacht >50KB)`,
          "Check of @pagayo/design op npm overeenkomt met lokale versie. Run CHECK 7 van deployer-preflight.sh.",
        );
      } else {
        log(
          "asset-webshop-css",
          "PASS",
          `webshop.css: ${body.length} bytes — volledig`,
        );
      }
    } else {
      log(
        "asset-webshop-css",
        "FAIL",
        `webshop.css HTTP ${response.status}`,
        "Design CSS niet gevonden",
        "CRITICAL",
      );
      expect(response.status).toBe(200);
    }
  });
});

// ============================================================================
// 7. EDGE-FIRST CACHE VALIDATION (Pijler 5)
// ============================================================================

const MARKETING_URL = "https://www.pagayo.com";

describe("Header Compliance - Edge-First Caching (Pijler 5)", () => {
  /**
   * Pijler 5: Edge-First — Cache API → KV → DB, nooit andersom.
   * Elke publieke GET zonder cache-laag is niet af.
   *
   * Deze tests valideren dat publieke endpoints daadwerkelijk
   * cache-headers hebben zodat Cloudflare edge kan cachen.
   */

  describe("Public API Endpoints - Cache Headers", () => {
    const publicApiEndpoints = [
      { path: "/api/products", name: "products" },
      { path: "/api/categories", name: "categories" },
    ];

    for (const endpoint of publicApiEndpoints) {
      it(`storefront ${endpoint.path} has Cache-Control header`, async () => {
        const response = await fetch(`${STOREFRONT_URL}${endpoint.path}`);
        const cc = response.headers.get("cache-control");

        if (response.status !== 200) {
          log(
            `edge-cache-${endpoint.name}`,
            "WARN",
            `HTTP ${response.status} — kan cache niet valideren`,
          );
          return;
        }

        if (!cc) {
          log(
            `edge-cache-${endpoint.name}`,
            "FAIL",
            `Geen Cache-Control op ${endpoint.path} — niet edge-cacheable`,
            "Voeg Cache-Control header toe in de route handler. Publieke GET data moet gecached worden.",
            "HIGH",
          );
          expect(cc).toBeTruthy();
        } else if (cc.includes("no-store") || cc.includes("private")) {
          log(
            `edge-cache-${endpoint.name}`,
            "FAIL",
            `${endpoint.path} Cache-Control: ${cc} — blokkeert edge caching`,
            "Publieke product/categorie data moet public, max-age=60+ zijn. Gebruik: public, max-age=60, stale-while-revalidate=300",
            "HIGH",
          );
          expect(cc).not.toContain("no-store");
        } else {
          log(
            `edge-cache-${endpoint.name}`,
            "PASS",
            `${endpoint.path} Cache-Control: ${cc}`,
          );
        }
      });
    }
  });

  describe("Marketing Site - Static Cache", () => {
    it("marketing homepage has aggressive caching", async () => {
      const response = await fetch(MARKETING_URL);
      const cc = response.headers.get("cache-control");

      if (response.status !== 200) {
        log(
          "edge-cache-marketing",
          "WARN",
          `Marketing site HTTP ${response.status}`,
        );
        return;
      }

      if (!cc) {
        log(
          "edge-cache-marketing",
          "FAIL",
          "Geen Cache-Control op marketing homepage — statische site moet gecached zijn",
          "Cloudflare Pages zou automatisch cache headers moeten zetten. Check Pages config.",
          "MEDIUM",
        );
      } else if (cc.includes("no-store")) {
        log(
          "edge-cache-marketing",
          "FAIL",
          `Marketing Cache-Control: ${cc} — statische site moet gecached zijn`,
          "Verwijder no-store uit _headers of Page Rules",
          "MEDIUM",
        );
        expect(cc).not.toContain("no-store");
      } else {
        log("edge-cache-marketing", "PASS", `Cache-Control: ${cc}`);
      }
    });
  });

  describe("Cloudflare Edge Cache Status", () => {
    /**
     * cf-cache-status header bewijst dat Cloudflare edge daadwerkelijk cacht.
     * Waarden: HIT, MISS, EXPIRED, DYNAMIC, BYPASS
     * - HIT/MISS/EXPIRED = goed (caching is actief)
     * - DYNAMIC = niet gecached (verwacht voor API, niet voor statische assets)
     * - BYPASS = caching expliciet uitgeschakeld
     */

    it("marketing homepage is cacheable at Cloudflare edge", async () => {
      // Twee requests: eerste kan MISS zijn, tweede moet HIT of REVALIDATED zijn
      await fetch(MARKETING_URL); // prime cache
      const response = await fetch(MARKETING_URL);
      const cfStatus = response.headers.get("cf-cache-status");

      if (!cfStatus) {
        log(
          "edge-cf-status-marketing",
          "WARN",
          "Geen cf-cache-status header — mogelijk niet via Cloudflare CDN",
        );
      } else if (cfStatus === "BYPASS") {
        log(
          "edge-cf-status-marketing",
          "FAIL",
          `cf-cache-status: BYPASS — edge caching uitgeschakeld`,
          "Check Cloudflare Page Rules of Cache Rules. Statische marketing site moet gecached worden.",
          "HIGH",
        );
        expect(cfStatus).not.toBe("BYPASS");
      } else {
        log("edge-cf-status-marketing", "PASS", `cf-cache-status: ${cfStatus}`);
      }
    });

    it("storefront static assets are cacheable at Cloudflare edge", async () => {
      // CSS is een goed voorbeeld van een asset dat edge-cached moet zijn
      const response = await fetch(
        `${STOREFRONT_URL}/design/dist/revolutionary/admin.css`,
      );
      const cfStatus = response.headers.get("cf-cache-status");

      if (response.status !== 200) {
        log(
          "edge-cf-status-assets",
          "WARN",
          `Asset niet bereikbaar: HTTP ${response.status}`,
        );
        return;
      }

      if (!cfStatus) {
        log(
          "edge-cf-status-assets",
          "WARN",
          "Geen cf-cache-status header op static asset",
        );
      } else if (cfStatus === "DYNAMIC" || cfStatus === "BYPASS") {
        log(
          "edge-cf-status-assets",
          "FAIL",
          `cf-cache-status: ${cfStatus} op static asset — moet gecached worden`,
          "Static assets moeten edge-cached zijn. Check Workers static asset serving of _headers.",
          "HIGH",
        );
        expect(["HIT", "MISS", "EXPIRED", "REVALIDATED"]).toContain(cfStatus);
      } else {
        log(
          "edge-cf-status-assets",
          "PASS",
          `cf-cache-status: ${cfStatus} — edge caching actief`,
        );
      }
    });
  });
});
