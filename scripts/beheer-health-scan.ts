/**
 * Pagayo Beheer API Health Scanner
 *
 * Scant ALLE endpoints van beheer.pagayo.com en rapporteert:
 * - 404: Route bestaat niet in backend
 * - 500/503: Server error (SQL, missende tabel, configuratie)
 * - 401: Auth vereist maar geen sessie (verwacht voor CF Access endpoints)
 * - 200/201: Endpoint werkt correct
 *
 * AUTHENTICATIE:
 * Beheer gebruikt Cloudflare Access (Zero Trust). Er is GEEN user/password login.
 * De scanner werkt in 2 modes:
 *
 * 1. Zonder auth — test alle routes op bereikbaarheid (401 = route bestaat)
 *    npx tsx scripts/beheer-health-scan.ts
 *
 * 2. Met CF Access cookie — volledige test met authenticatie
 *    CF_AUTH_COOKIE="CF_Authorization=eyJ..." npx tsx scripts/beheer-health-scan.ts
 *
 *    Hoe je de cookie krijgt:
 *    - Open beheer.pagayo.com in browser
 *    - Login via Cloudflare Access
 *    - DevTools → Application → Cookies → kopieer CF_Authorization waarde
 *
 * Specifieke URL:
 *    BEHEER_URL="https://beheer.pagayo.com" npx tsx scripts/beheer-health-scan.ts
 *
 * @module scripts/beheer-health-scan
 */

// ===========================================
// CONSTANTS
// ===========================================

/** Basis URL van Beheer API */
const BEHEER_URL = process.env.BEHEER_URL || "https://beheer.pagayo.com";

/** CF Access cookie (optioneel — voor volledige auth test) */
const CF_AUTH_COOKIE = process.env.CF_AUTH_COOKIE || "";

/**
 * Lokale modus: dev auto-login is actief, endpoints antwoorden alsof je bent ingelogd.
 * In dit geval verwachten we 200/400/404 i.p.v. 302/401.
 */
const IS_LOCAL =
  BEHEER_URL.includes("localhost") || BEHEER_URL.includes("127.0.0.1");

/** Is volledig geauthenticeerd (lokaal of met CF cookie) */
const IS_AUTHENTICATED = IS_LOCAL || !!CF_AUTH_COOKIE;

/** Request timeout in milliseconden */
const TIMEOUT_MS = 15_000;

/** Delay tussen requests (ms) — voorkom rate limiting lokaal */
const REQUEST_DELAY_MS = IS_LOCAL ? 500 : 50;

/** Max retries bij 429 Too Many Requests */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** Placeholder IDs voor parameterized routes */
const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_TENANT_ID = "test-tenant-000";
const PLACEHOLDER_SUB_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_PARTNER_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_WORKFLOW_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_INVOICE_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_FEE_CONFIG_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_FEE_INVOICE_ID = "00000000-0000-0000-0000-000000000000";

// ===========================================
// ENDPOINT DEFINITIES
// ===========================================

interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  /** Beschrijving voor rapport */
  description: string;
  /** Verwachte status codes die OK zijn */
  okCodes: number[];
  /** Body voor POST/PUT/PATCH (optioneel) */
  body?: Record<string, unknown>;
  /** Endpoint vereist CF Access auth */
  requiresAuth?: boolean;
  /** Categorie voor gegroepeerde rapportage */
  category: string;
  /** Endpoint vereist Storefront service binding (niet beschikbaar lokaal) */
  serviceBindingRequired?: boolean;
}

const ENDPOINTS: EndpointDef[] = [
  // ═══════════════════════════════════════════
  // HEALTH (publiek — geen auth)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/health",
    description: "Basic health check",
    okCodes: [200],
    category: "Health",
  },
  {
    method: "GET",
    path: "/health/ready",
    description: "Readiness check (KV + R2)",
    okCodes: [200],
    category: "Health",
  },

  // ═══════════════════════════════════════════
  // AUTH (deels publiek)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/auth/session",
    description: "Sessie status (publiek)",
    okCodes: [200],
    category: "Auth",
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    description: "Logout (CF Access redirect)",
    okCodes: [200],
    requiresAuth: true,
    category: "Auth",
  },
  {
    method: "GET",
    path: "/api/auth/logout-url",
    description: "Logout URL ophalen",
    okCodes: [200],
    requiresAuth: true,
    category: "Auth",
  },
  {
    method: "GET",
    path: "/api/auth/login",
    description: "Login trigger (CF Access redirect)",
    okCodes: [200, 302],
    requiresAuth: true,
    category: "Auth",
  },

  // ═══════════════════════════════════════════
  // CAPABILITIES (features endpoint publiek)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/capabilities/features",
    description: "Feature registry (publiek)",
    okCodes: [200],
    category: "Capabilities",
  },
  {
    method: "GET",
    path: `/api/capabilities/organizations/${PLACEHOLDER_ORG_ID}/capabilities`,
    description: "Organization capabilities",
    okCodes: [200, 403, 404],
    requiresAuth: true,
    category: "Capabilities",
  },
  {
    method: "GET",
    path: `/api/capabilities/organizations/${PLACEHOLDER_ORG_ID}/capabilities/WEBSHOP`,
    description: "Specifieke capability (WEBSHOP)",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Capabilities",
  },
  {
    method: "PUT",
    path: `/api/capabilities/organizations/${PLACEHOLDER_ORG_ID}/capabilities/WEBSHOP`,
    description: "Update capability",
    okCodes: [200, 403],
    body: { level: 1, source: "MANUAL" },
    requiresAuth: true,
    category: "Capabilities",
  },
  {
    method: "POST",
    path: `/api/capabilities/organizations/${PLACEHOLDER_ORG_ID}/capabilities/bulk`,
    description: "Bulk capabilities update",
    okCodes: [200, 403],
    body: { capabilities: [] },
    requiresAuth: true,
    category: "Capabilities",
  },
  {
    method: "POST",
    path: `/api/capabilities/organizations/${PLACEHOLDER_ORG_ID}/capabilities/preset`,
    description: "Capability preset toepassen",
    okCodes: [200, 403],
    body: { preset: "STARTER" },
    requiresAuth: true,
    category: "Capabilities",
  },

  // ═══════════════════════════════════════════
  // ORGANIZATIONS
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/organizations",
    description: "Lijst organizations",
    okCodes: [200],
    requiresAuth: true,
    category: "Organizations",
  },
  {
    method: "GET",
    path: `/api/organizations/${PLACEHOLDER_ORG_ID}`,
    description: "Organization detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Organizations",
  },
  {
    method: "GET",
    path: "/api/organizations/me/onboarding",
    description: "Eigen onboarding status",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Organizations",
  },
  {
    method: "GET",
    path: `/api/organizations/${PLACEHOLDER_ORG_ID}/users`,
    description: "Organization users",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Organizations",
  },
  {
    method: "GET",
    path: `/api/organizations/${PLACEHOLDER_ORG_ID}/resources`,
    description: "Organization resources",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Organizations",
  },
  {
    method: "GET",
    path: `/api/organizations/${PLACEHOLDER_ORG_ID}/resources/${PLACEHOLDER_RESOURCE_ID}`,
    description: "Resource detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Organizations",
  },

  // ═══════════════════════════════════════════
  // BILLING
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/billing/invoices",
    description: "Facturen lijst",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: `/api/billing/invoices/${PLACEHOLDER_INVOICE_ID}`,
    description: "Factuur detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: "/api/billing/financial-overview",
    description: "Financieel overzicht",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: "/api/billing/metrics",
    description: "Billing metrics",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: "/api/billing/platform-fee-configs",
    description: "Platform fee configuraties",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: `/api/billing/platform-fee-configs/${PLACEHOLDER_FEE_CONFIG_ID}`,
    description: "Fee config detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: "/api/billing/payouts/schedule",
    description: "Uitbetalingsschema",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: "/api/billing/payouts/schedule/export",
    description: "Uitbetalingsschema export",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: "/api/billing/platform-fee-invoices",
    description: "Platform fee facturen",
    okCodes: [200],
    requiresAuth: true,
    category: "Billing",
  },
  {
    method: "GET",
    path: `/api/billing/platform-fee-invoices/${PLACEHOLDER_FEE_INVOICE_ID}`,
    description: "Platform fee factuur detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Billing",
  },

  // ═══════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: `/api/subscriptions/organizations/${PLACEHOLDER_ORG_ID}/subscriptions`,
    description: "Organization subscriptions",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Subscriptions",
  },
  {
    method: "GET",
    path: `/api/subscriptions/organizations/${PLACEHOLDER_ORG_ID}/subscriptions/statistics`,
    description: "Subscription statistieken",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Subscriptions",
  },
  {
    method: "GET",
    path: `/api/subscriptions/organizations/${PLACEHOLDER_ORG_ID}/subscriptions/mrr`,
    description: "MRR breakdown",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Subscriptions",
  },
  {
    method: "GET",
    path: `/api/subscriptions/organizations/${PLACEHOLDER_ORG_ID}/subscriptions/upcoming`,
    description: "Upcoming billing",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Subscriptions",
  },
  {
    method: "GET",
    path: `/api/subscriptions/subscriptions/${PLACEHOLDER_SUB_ID}`,
    description: "Subscription detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Subscriptions",
  },
  {
    method: "GET",
    path: `/api/subscriptions/subscriptions/${PLACEHOLDER_SUB_ID}/payments`,
    description: "Subscription payments",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Subscriptions",
  },

  // ═══════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/admin/queries",
    description: "SQL queries overzicht",
    okCodes: [200],
    requiresAuth: true,
    category: "Admin",
  },
  {
    method: "GET",
    path: "/api/admin/metrics",
    description: "Platform metrics",
    okCodes: [200],
    requiresAuth: true,
    category: "Admin",
  },
  {
    method: "GET",
    path: "/api/admin/health",
    description: "Admin health check",
    okCodes: [200],
    requiresAuth: true,
    category: "Admin",
  },

  // ═══════════════════════════════════════════
  // PROVISIONING (under /api/admin/provisioning)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/admin/provisioning",
    description: "Alle tenants overzicht",
    okCodes: [200],
    requiresAuth: true,
    category: "Provisioning",
    serviceBindingRequired: true,
  },
  {
    method: "GET",
    path: `/api/admin/provisioning/workflow/${PLACEHOLDER_WORKFLOW_ID}`,
    description: "Workflow status",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Provisioning",
  },
  {
    method: "GET",
    path: `/api/admin/provisioning/${PLACEHOLDER_TENANT_ID}`,
    description: "Tenant detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Provisioning",
    serviceBindingRequired: true,
  },

  // ═══════════════════════════════════════════
  // STRIPE (webhooks publiek, rest protected)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/stripe/customers",
    description: "Stripe klanten",
    okCodes: [200],
    requiresAuth: true,
    category: "Stripe",
  },
  {
    method: "GET",
    path: "/api/stripe/payments",
    description: "Stripe betalingen",
    okCodes: [200],
    requiresAuth: true,
    category: "Stripe",
  },

  // ═══════════════════════════════════════════
  // WORKFLOWS (publiek — polled na registratie)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: `/api/workflows/${PLACEHOLDER_WORKFLOW_ID}/status`,
    description: "Workflow status (publiek, 502 verwacht met fake ID)",
    okCodes: [200, 404, 502],
    category: "Workflows",
  },

  // ═══════════════════════════════════════════
  // PARTNERS (platform admin)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/partners",
    description: "Partners lijst",
    okCodes: [200],
    requiresAuth: true,
    category: "Partners",
  },
  {
    method: "GET",
    path: `/api/partners/${PLACEHOLDER_PARTNER_ID}`,
    description: "Partner detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Partners",
  },
  {
    method: "GET",
    path: `/api/partners/${PLACEHOLDER_PARTNER_ID}/organizations`,
    description: "Partner organizations",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Partners",
  },
  {
    method: "GET",
    path: `/api/partners/${PLACEHOLDER_PARTNER_ID}/users`,
    description: "Partner users",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Partners",
  },
  {
    method: "GET",
    path: `/api/partners/${PLACEHOLDER_PARTNER_ID}/metrics`,
    description: "Partner metrics",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Partners",
  },

  // ═══════════════════════════════════════════
  // PARTNER PORTAL (achter CF Access + eigen auth)
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/partner-portal/me",
    description: "Partner portal profiel",
    okCodes: [200, 401],
    requiresAuth: true,
    category: "Partner Portal",
  },
  {
    method: "GET",
    path: "/api/partner-portal/partner",
    description: "Partner portal partner info",
    okCodes: [200, 401],
    requiresAuth: true,
    category: "Partner Portal",
  },
  {
    method: "GET",
    path: "/api/partner-portal/organizations",
    description: "Partner portal organizations",
    okCodes: [200, 401],
    requiresAuth: true,
    category: "Partner Portal",
  },
  {
    method: "GET",
    path: "/api/partner-portal/metrics",
    description: "Partner portal metrics",
    okCodes: [200, 401],
    requiresAuth: true,
    category: "Partner Portal",
  },
  {
    method: "GET",
    path: "/api/partner-portal/metrics/trend",
    description: "Partner portal metrics trend",
    okCodes: [200, 401],
    requiresAuth: true,
    category: "Partner Portal",
  },

  // ═══════════════════════════════════════════
  // TIERS
  // ═══════════════════════════════════════════
  {
    method: "GET",
    path: "/api/tiers/config",
    description: "Tier configuratie",
    okCodes: [200],
    requiresAuth: true,
    category: "Tiers",
  },
  {
    method: "GET",
    path: "/api/tiers/statistics",
    description: "Tier statistieken",
    okCodes: [200],
    requiresAuth: true,
    category: "Tiers",
  },
  {
    method: "GET",
    path: "/api/tiers/organizations",
    description: "Tier organizations overzicht",
    okCodes: [200],
    requiresAuth: true,
    category: "Tiers",
  },
  {
    method: "GET",
    path: `/api/tiers/organizations/${PLACEHOLDER_ORG_ID}`,
    description: "Organization tier detail",
    okCodes: [200, 404],
    requiresAuth: true,
    category: "Tiers",
  },
];

// ===========================================
// SCAN RESULT TYPE
// ===========================================

interface ScanResult {
  endpoint: EndpointDef;
  status: number;
  ok: boolean;
  duration: number;
  error?: string;
  /** Response snippet voor debugging */
  responseSnippet?: string;
  /** True als endpoint rate limited was na alle retries */
  rateLimited?: boolean;
}

// ===========================================
// SCANNER ENGINE
// ===========================================

/**
 * Sleep utility voor delays.
 *
 * @param ms - Milliseconden om te wachten
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scant één endpoint en retourneert het resultaat.
 * Bij 429 (rate limited) wordt automatisch geretried.
 *
 * @param endpoint - De endpoint definitie
 * @param retryCount - Huidige retry poging (intern)
 * @returns ScanResult met status, timing en eventuele error
 */
async function scanEndpoint(
  endpoint: EndpointDef,
  retryCount = 0,
): Promise<ScanResult> {
  const url = `${BEHEER_URL}${endpoint.path}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Voeg CF Access cookie toe als beschikbaar
    if (CF_AUTH_COOKIE) {
      headers.Cookie = CF_AUTH_COOKIE;
    }

    const fetchOptions: RequestInit = {
      method: endpoint.method,
      headers,
      signal: controller.signal,
      redirect: "manual", // Niet automatisch volgen (CF Access redirect = 302)
    };

    if (endpoint.body && ["POST", "PUT", "PATCH"].includes(endpoint.method)) {
      fetchOptions.body = JSON.stringify(endpoint.body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    // Retry bij rate limiting
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = RETRY_DELAY_MS * (retryCount + 1);
      process.stdout.write(`⏳ rate limited, retry in ${retryAfter}ms... `);
      await sleep(retryAfter);
      return scanEndpoint(endpoint, retryCount + 1);
    }

    // Na alle retries nog steeds 429 → markeer als rate limited (niet als fout)
    if (response.status === 429) {
      const duration = Date.now() - start;
      return {
        endpoint,
        status: 429,
        ok: false,
        duration,
        rateLimited: true,
        responseSnippet:
          "Rate limited na alle retries — herstart scanner na 15 min",
      };
    }

    const duration = Date.now() - start;

    // Bepaal of het resultaat OK is
    let ok = false;

    if (endpoint.serviceBindingRequired && IS_LOCAL && response.status >= 500) {
      // Service binding endpoints falen lokaal — verwacht gedrag, geen echte fout
      ok = true;
    } else if (endpoint.requiresAuth && !IS_AUTHENTICATED) {
      // Zonder auth verwachten we 401 of 302 (CF Access redirect)
      // 401 = route bestaat, auth vereist (correct gedrag)
      // 302 = CF Access redirect naar login (correct gedrag)
      // 403 = route bestaat, niet geautoriseerd (correct gedrag)
      ok = [401, 302, 403].includes(response.status);
    } else {
      // Geauthenticeerd (lokaal of CF cookie): test op okCodes
      // 400 = validatie error (verwacht voor placeholder data)
      // 403 = forbidden (dev user heeft niet altijd SUPER_ADMIN)
      ok =
        endpoint.okCodes.includes(response.status) ||
        [400, 403].includes(response.status);
    }

    // Lees response snippet voor debugging bij errors
    let responseSnippet: string | undefined;
    if (!ok || response.status >= 500) {
      try {
        const text = await response.text();
        responseSnippet = text.substring(0, 200);
      } catch {
        responseSnippet = "(kan response niet lezen)";
      }
    }

    return { endpoint, status: response.status, ok, duration, responseSnippet };
  } catch (err) {
    const duration = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : "Onbekende fout";

    return {
      endpoint,
      status: 0,
      ok: false,
      duration,
      error: errorMessage.includes("abort")
        ? `Timeout (>${TIMEOUT_MS}ms)`
        : errorMessage,
    };
  }
}

// ===========================================
// RAPPORT GENERATOR
// ===========================================

/**
 * Genereert een gedetailleerd rapport van alle scan resultaten.
 *
 * @param results - Alle scan resultaten
 */
function printReport(results: ScanResult[]): void {
  const ok = results.filter((r) => r.ok);
  const rateLimited = results.filter((r) => r.rateLimited);
  const failed = results.filter((r) => !r.ok && !r.rateLimited);
  const errors500 = failed.filter((r) => r.status >= 500 || r.status === 503);
  const notFound404 = failed.filter((r) => r.status === 404);
  const unexpected = failed.filter(
    (r) => r.status !== 0 && r.status < 500 && r.status !== 404,
  );
  const timeouts = failed.filter((r) => r.status === 0);

  console.log("\n");
  console.log("══════════════════════════════════════════════════");
  console.log("  📋 PAGAYO BEHEER — API HEALTH RAPPORT");
  console.log("══════════════════════════════════════════════════");
  console.log(`  Target:     ${BEHEER_URL}`);
  console.log(
    `  Auth mode:  ${IS_LOCAL ? "Lokaal (dev auto-login) ✅" : CF_AUTH_COOKIE ? "CF Access cookie ✅" : "Geen auth (route-check)"}`,
  );
  console.log(`  Totaal:     ${results.length} endpoints`);
  console.log(`  OK:         ${ok.length} ✅`);
  if (rateLimited.length > 0) {
    console.log(
      `  Rate limit: ${rateLimited.length} ⏳ (niet geteld als fout)`,
    );
  }
  console.log(
    `  Problemen:  ${failed.length} ${failed.length > 0 ? "⚠️" : ""}`,
  );
  console.log("══════════════════════════════════════════════════");

  // Server errors (500+) — KRITIEK
  if (errors500.length > 0) {
    console.log("\n─── 🔴 SERVER ERRORS (500+) — KRITIEK ──────────");
    console.log(
      "  Server crashes. Check Worker logs in Cloudflare dashboard.\n",
    );
    for (const r of errors500) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}  [${r.endpoint.category}]`,
      );
      console.log(`         ${r.endpoint.description}`);
      console.log(`         Status: ${r.status} | ${r.duration}ms`);
      if (r.responseSnippet) {
        console.log(
          `         Response: ${r.responseSnippet.substring(0, 120)}`,
        );
      }
      console.log();
    }
  }

  // 404 — Route mist
  if (notFound404.length > 0) {
    console.log("\n─── 🟡 NIET GEVONDEN (404) — ROUTE MIST ────────");
    console.log(
      "  Frontend/scanner verwacht deze maar backend mist handler.\n",
    );
    for (const r of notFound404) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}  [${r.endpoint.category}]`,
      );
      console.log(`         ${r.endpoint.description}`);
      console.log();
    }
  }

  // Unexpected status codes
  if (unexpected.length > 0) {
    console.log("\n─── 🟠 ONVERWACHTE STATUS ──────────────────────");
    console.log("  Niet 200/401/404/500 — vereist onderzoek.\n");
    for (const r of unexpected) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}  [${r.endpoint.category}]`,
      );
      console.log(`         ${r.endpoint.description} → Status: ${r.status}`);
      if (r.responseSnippet) {
        console.log(
          `         Response: ${r.responseSnippet.substring(0, 120)}`,
        );
      }
      console.log();
    }
  }

  // Timeouts
  if (timeouts.length > 0) {
    console.log("\n─── 💀 TIMEOUTS / NETWORK ERRORS ───────────────");
    for (const r of timeouts) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}  [${r.endpoint.category}]`,
      );
      console.log(`         Error: ${r.error}`);
      console.log();
    }
  }

  // Werkende endpoints (gegroepeerd per categorie)
  if (ok.length > 0) {
    console.log("\n─── ✅ WERKENDE ENDPOINTS ────────────────────────");

    const categories = [...new Set(ok.map((r) => r.endpoint.category))];
    for (const cat of categories) {
      const catResults = ok.filter((r) => r.endpoint.category === cat);
      console.log(`\n  [${cat}]`);
      for (const r of catResults) {
        const statusLabel =
          r.status === 401
            ? "AUTH"
            : r.status === 302
              ? "REDIR"
              : r.status === 403
                ? "FORBID"
                : String(r.status);
        console.log(
          `    ${r.endpoint.method.padEnd(6)} ${r.endpoint.path.padEnd(65)} ${statusLabel.padEnd(5)} ${r.duration}ms`,
        );
      }
    }
  }

  // Rate limited endpoints
  if (rateLimited.length > 0) {
    console.log("\n─── ⏳ RATE LIMITED ──────────────────────────────");
    console.log(
      `  ${rateLimited.length} endpoints overgeslagen (429 Too Many Requests).`,
    );
    console.log(
      "  Herstart de scanner na 15 minuten voor volledige resultaten.",
    );
    console.log("  Dit is GEEN endpoint fout, maar een scanner limitatie.\n");
  }

  // Trage endpoints
  const slow = results.filter((r) => r.duration > 3000 && r.ok);
  if (slow.length > 0) {
    console.log("\n─── 🐌 TRAGE ENDPOINTS (>3s) ────────────────────");
    for (const r of slow) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path.padEnd(55)} ${r.duration}ms`,
      );
    }
  }

  // Samenvatting
  console.log("\n══════════════════════════════════════════════════");
  if (failed.length === 0) {
    console.log("  🎉 Alle endpoints werken correct!");
  } else {
    console.log(`  ⚠️  ${failed.length} problemen gevonden:`);
    if (errors500.length > 0) {
      console.log(`     🔴 ${errors500.length} server errors (KRITIEK)`);
    }
    if (notFound404.length > 0) {
      console.log(`     🟡 ${notFound404.length} routes niet gevonden`);
    }
    if (unexpected.length > 0) {
      console.log(`     🟠 ${unexpected.length} onverwachte status codes`);
    }
    if (timeouts.length > 0) {
      console.log(`     💀 ${timeouts.length} timeouts/network errors`);
    }
    if (rateLimited.length > 0) {
      console.log(
        `     ⏳ ${rateLimited.length} rate limited (herstart na 15 min)`,
      );
    }

    if (!IS_AUTHENTICATED) {
      console.log();
      console.log(
        "  💡 Tip: test lokaal met auto-login of voeg CF Access cookie toe:",
      );
      console.log(
        `     BEHEER_URL="http://localhost:3003" npx tsx scripts/beheer-health-scan.ts`,
      );
      console.log(
        `     CF_AUTH_COOKIE="CF_Authorization=eyJ..." npx tsx scripts/beheer-health-scan.ts`,
      );
    }
  }
  console.log("══════════════════════════════════════════════════\n");
}

// ===========================================
// MAIN
// ===========================================

async function main(): Promise<void> {
  console.log();
  console.log("══════════════════════════════════════════════════");
  console.log("  🔍 Pagayo Beheer — API Health Scanner");
  console.log("══════════════════════════════════════════════════");
  console.log(`  Target: ${BEHEER_URL}`);
  console.log(
    `  Auth:   ${IS_LOCAL ? "Lokaal (dev auto-login als info@pagayo.com) ✅" : CF_AUTH_COOKIE ? "CF Access cookie meegegeven ✅" : "Geen auth — route-check modus"}`,
  );
  console.log(`  Datum:  ${new Date().toISOString()}`);
  console.log("══════════════════════════════════════════════════\n");

  if (IS_LOCAL) {
    console.log(
      "  ℹ️  Lokale modus: dev auto-login actief. Endpoints worden volledig getest.",
    );
    console.log(
      "     200 = werkt | 400 = validatie (ok met fake data) | 404 = entity niet gevonden (ok)",
    );
    console.log("     500 = server error (KRITIEK)\n");
  } else if (!CF_AUTH_COOKIE) {
    console.log("  ℹ️  Zonder CF Access cookie test ik of routes BESTAAN.");
    console.log("     401/302 = route bestaat (auth correct).");
    console.log("     404 = route MIST in backend.");
    console.log("     500 = server error (KRITIEK).\n");
  }

  console.log(`📋 Scanning ${ENDPOINTS.length} endpoints...\n`);

  // Scan sequentieel (voorkom rate limiting)
  const results: ScanResult[] = [];
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(
      `  ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(70)}`,
    );
    const result = await scanEndpoint(endpoint);
    results.push(result);

    // Delay tussen requests om rate limiting te voorkomen
    await sleep(REQUEST_DELAY_MS);

    const icon = result.rateLimited
      ? "⏳"
      : result.status === 0
        ? "💀"
        : result.status >= 500
          ? "🔴"
          : result.status === 404
            ? "🟡"
            : result.ok
              ? "✅"
              : "🟠";
    console.log(`${icon} ${result.status} (${result.duration}ms)`);
  }

  printReport(results);

  // Exit code: 1 als er ECHTE fouten zijn (rate limited telt NIET mee)
  const critical = results.filter((r) => !r.ok && !r.rateLimited);
  process.exit(critical.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Scanner crashed:", err);
  process.exit(2);
});
