/**
 * Pagayo API Health Scanner
 *
 * Scant ALLE admin endpoints voor een tenant en rapporteert:
 * - 404: Route bestaat niet in backend
 * - 500: Server error (SQL kolom mismatch, missende tabel, etc.)
 * - 401: Auth vereist maar geen sessie (verwacht gedrag)
 * - 200/201: Endpoint werkt correct
 *
 * GEBRUIK (automatisch inloggen):
 *   ADMIN_EMAIL="2000@pagayo.com" ADMIN_PASSWORD="Test1234" npx tsx scripts/api-health-scan.ts
 *
 * Of met handmatige cookie:
 *   ADMIN_COOKIE="pagayo_session=abc123" npx tsx scripts/api-health-scan.ts
 *
 * Specifieke tenant:
 *   TENANT_URL="https://test-2000.pagayo.app" ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/api-health-scan.ts
 *
 * @module scripts/api-health-scan
 */

// ===========================================
// CONFIGURATIE
// ===========================================

const TENANT_URL = process.env.TENANT_URL || "https://test-2000.pagayo.app";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
let sessionCookie = process.env.ADMIN_COOKIE || "";
let csrfToken = "";
let csrfCookie = "";
const TIMEOUT_MS = 10_000;

// ===========================================
// ALLE ENDPOINTS DIE DE FRONTEND AANROEPT
// ===========================================

interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  /** Beschrijving voor rapport */
  description: string;
  /** Verwachte status codes die OK zijn */
  okCodes: number[];
  /** Body voor POST/PUT (optioneel) */
  body?: Record<string, unknown>;
  /** Skip als geen sessie */
  requiresAuth?: boolean;
}

const ENDPOINTS: EndpointDef[] = [
  // === AUTH ===
  {
    method: "GET",
    path: "/api/admin/csrf",
    description: "CSRF token",
    okCodes: [200],
  },
  {
    method: "GET",
    path: "/api/admin/session",
    description: "Sessie status",
    okCodes: [200],
  },

  // === DASHBOARD (geladen bij eerste bezoek) ===
  {
    method: "GET",
    path: "/api/admin/stats",
    description: "Dashboard statistieken",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/stats/low-stock",
    description: "Low stock producten",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/ai/config",
    description: "AI configuratie",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/ai/suggestions",
    description: "AI suggesties",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/organization/onboarding",
    description: "Onboarding status",
    okCodes: [200],
    requiresAuth: true,
  },

  // === PRODUCTEN ===
  {
    method: "GET",
    path: "/api/admin/products",
    description: "Producten lijst",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/products/1",
    description: "Product detail",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/categories",
    description: "Categorieën lijst",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/categories/flat",
    description: "Categorieën flat",
    okCodes: [200],
    requiresAuth: true,
  },

  // === ORDERS ===
  {
    method: "GET",
    path: "/api/admin/orders",
    description: "Orders lijst",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "PUT",
    path: "/api/admin/orders/batch/status",
    description: "Batch order status update",
    okCodes: [200, 400],
    requiresAuth: true,
    body: { orderIds: [], status: "pending" },
  },

  // === KLANTEN ===
  {
    method: "GET",
    path: "/api/admin/customers",
    description: "Klanten lijst",
    okCodes: [200],
    requiresAuth: true,
  },

  // === FACTUREN ===
  {
    method: "GET",
    path: "/api/admin/invoices",
    description: "Facturen lijst",
    okCodes: [200],
    requiresAuth: true,
  },

  // === INSTELLINGEN ===
  {
    method: "GET",
    path: "/api/admin/settings",
    description: "Alle instellingen",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/storeName",
    description: "Setting: storeName",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/vatConfig",
    description: "Setting: vatConfig",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/shippingStandard",
    description: "Setting: shippingStandard",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/shippingExpress",
    description: "Setting: shippingExpress",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/freeShippingEnabled",
    description: "Setting: freeShippingEnabled",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/freeShippingThreshold",
    description: "Setting: freeShippingThreshold",
    okCodes: [200, 404],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/active-modules",
    description: "Actieve modules",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/emails",
    description: "Email settings",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/settings/product-settings",
    description: "Product display settings",
    okCodes: [200],
    requiresAuth: true,
  },

  // === TEAM ===
  {
    method: "GET",
    path: "/api/admin/team",
    description: "Team leden",
    okCodes: [200],
    requiresAuth: true,
  },

  // === PAGES / BLOG ===
  {
    method: "GET",
    path: "/api/admin/pages",
    description: "Pagina's lijst",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/blog",
    description: "Blog posts lijst",
    okCodes: [200],
    requiresAuth: true,
  },

  // === INTEGRATIES ===
  {
    method: "GET",
    path: "/api/admin/integrations/stripe/connect/status",
    description: "Stripe Connect status",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/integrations/bolcom",
    description: "Bol.com status",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/integrations/amazon",
    description: "Amazon status",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/psp",
    description: "PSP overzicht",
    okCodes: [200],
    requiresAuth: true,
  },

  // === ROLLEN ===
  {
    method: "GET",
    path: "/api/admin/roles-ui",
    description: "Rollen lijst",
    okCodes: [200],
    requiresAuth: true,
  },

  // === AI (extra) ===
  {
    method: "POST",
    path: "/api/admin/ai/generate-config",
    description: "AI config genereren",
    okCodes: [200],
    requiresAuth: true,
    body: {},
  },

  // === COUPONS ===
  {
    method: "GET",
    path: "/api/admin/coupons",
    description: "Coupons lijst",
    okCodes: [200],
    requiresAuth: true,
  },

  // === RETURNS ===
  {
    method: "GET",
    path: "/api/admin/returns",
    description: "Retouren lijst",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/returns/stats",
    description: "Retouren stats",
    okCodes: [200],
    requiresAuth: true,
  },

  // === REVIEWS ===
  {
    method: "GET",
    path: "/api/admin/reviews",
    description: "Reviews lijst",
    okCodes: [200],
    requiresAuth: true,
  },

  // === MESSAGES ===
  {
    method: "GET",
    path: "/api/admin/messages",
    description: "Berichten lijst",
    okCodes: [200],
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/admin/messages/stats",
    description: "Berichten stats",
    okCodes: [200],
    requiresAuth: true,
  },

  // === AUTH ENDPOINTS (frontend verwacht onder /api/admin/) ===
  {
    method: "POST",
    path: "/api/admin/forgot-password",
    description: "Wachtwoord vergeten",
    okCodes: [200, 400, 404],
    body: { email: "test@test.com" },
  },
  {
    method: "POST",
    path: "/api/admin/reset-password",
    description: "Wachtwoord resetten",
    okCodes: [200, 400, 404],
    body: { token: "x", newPassword: "Test123!" },
  },
];

// ===========================================
// SCANNER
// ===========================================

interface ScanResult {
  endpoint: EndpointDef;
  status: number;
  ok: boolean;
  duration: number;
  error?: string;
  body?: string;
}

async function scanEndpoint(endpoint: EndpointDef): Promise<ScanResult> {
  const url = `${TENANT_URL}${endpoint.path}`;
  const start = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Build cookie string with session + CSRF cookies
  const cookies: string[] = [];
  if (sessionCookie) cookies.push(sessionCookie);
  if (csrfCookie) cookies.push(csrfCookie);
  if (cookies.length > 0) {
    headers["Cookie"] = cookies.join("; ");
  }

  // Add CSRF header for mutation requests
  if (csrfToken && ["POST", "PUT", "DELETE"].includes(endpoint.method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeout);

    const duration = Date.now() - start;
    const ok =
      endpoint.okCodes.includes(response.status) ||
      // 401 is OK als we geen sessie meesturen
      (!sessionCookie && response.status === 401);

    let body: string | undefined;
    if (response.status >= 400 && response.status !== 401) {
      try {
        body = await response.text();
        if (body.length > 300) body = body.substring(0, 300) + "...";
      } catch {
        body = "(kon body niet lezen)";
      }
    }

    return { endpoint, status: response.status, ok, duration, body };
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    return { endpoint, status: 0, ok: false, duration, error };
  }
}

// ===========================================
// RAPPORT
// ===========================================

function printReport(results: ScanResult[]): void {
  const failed = results.filter((r) => !r.ok);
  const errors500 = results.filter((r) => !r.ok && r.status === 500);
  const notFound404 = results.filter((r) => !r.ok && r.status === 404);
  const auth401 = results.filter((r) => r.status === 401);
  const ok200 = results.filter((r) => r.ok);
  const timeouts = results.filter((r) => r.status === 0);
  const other = results.filter(
    (r) => !r.ok && r.status !== 500 && r.status !== 404 && r.status !== 401 && r.status !== 0,
  );

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         PAGAYO API HEALTH SCAN RAPPORT          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\n  Tenant:    ${TENANT_URL}`);
  console.log(
    `  Sessie:    ${sessionCookie ? "JA (admin sessie)" : "NEE (alleen route-check)"}`,
  );
  console.log(`  Endpoints: ${results.length} gescand`);
  console.log(`  Datum:     ${new Date().toISOString()}`);

  console.log("\n─── SAMENVATTING ────────────────────────────────");
  console.log(`  ✅ OK:                 ${ok200.length}`);
  console.log(`  🔒 Auth vereist (401): ${auth401.length}`);
  console.log(`  ❌ Server Error (500):  ${errors500.length}`);
  console.log(`  ⚠️  Niet gevonden (404): ${notFound404.length}`);
  console.log(`  💀 Timeout/Error:      ${timeouts.length}`);
  if (other.length > 0) {
    console.log(`  ❓ Overig:             ${other.length}`);
  }

  if (errors500.length > 0) {
    console.log("\n─── 🚨 SERVER ERRORS (500) — MOET GEFIXT ────────");
    console.log(
      "  Deze endpoints crashen. Waarschijnlijk SQL kolom/tabel mismatch.\n",
    );
    for (const r of errors500) {
      console.log(`  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}`);
      console.log(`         ${r.endpoint.description}`);
      console.log(`         ${r.duration}ms`);
      if (r.body) console.log(`         Response: ${r.body.substring(0, 200)}`);
      console.log();
    }
  }

  if (notFound404.length > 0) {
    console.log("\n─── ⚠️  NIET GEVONDEN (404) — ROUTE MIST ────────");
    console.log("  Frontend roept deze aan maar backend heeft geen handler.\n");
    for (const r of notFound404) {
      console.log(`  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}`);
      console.log(`         ${r.endpoint.description}`);
      console.log();
    }
  }

  if (timeouts.length > 0) {
    console.log("\n─── 💀 TIMEOUTS / ERRORS ────────────────────────");
    for (const r of timeouts) {
      console.log(`  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path}`);
      console.log(`         Error: ${r.error}`);
      console.log();
    }
  }

  if (sessionCookie && ok200.length > 0) {
    console.log("\n─── ✅ WERKENDE ENDPOINTS ────────────────────────");
    for (const r of ok200) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path.padEnd(50)} ${r.status}  ${r.duration}ms`,
      );
    }
  }

  // Slow endpoints
  const slow = results.filter((r) => r.duration > 2000 && r.ok);
  if (slow.length > 0) {
    console.log("\n─── 🐌 TRAGE ENDPOINTS (>2s) ────────────────────");
    for (const r of slow) {
      console.log(
        `  ${r.endpoint.method.padEnd(6)} ${r.endpoint.path.padEnd(50)} ${r.duration}ms`,
      );
    }
  }

  console.log("\n──────────────────────────────────────────────────");

  if (
    errors500.length === 0 &&
    notFound404.length === 0 &&
    timeouts.length === 0
  ) {
    console.log("  🎉 Alle endpoints werken correct!");
  } else {
    console.log(`  ⚠️  ${failed.length} problemen gevonden.`);
    if (!sessionCookie) {
      console.log(
        "  💡 Tip: voer opnieuw uit met login credentials voor volledige scan:",
      );
      console.log(
        `     ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npx tsx scripts/api-health-scan.ts`,
      );
    }
  }
  console.log();
}

// ===========================================
// LOGIN FLOW
// ===========================================

/**
 * Extracts Set-Cookie values from response headers.
 */
function extractCookies(response: Response): Map<string, string> {
  const cookies = new Map<string, string>();
  // response.headers.getSetCookie() returns all Set-Cookie headers
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(";");
    if (nameValue) {
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx > 0) {
        const name = nameValue.substring(0, eqIdx).trim();
        const value = nameValue.substring(eqIdx + 1).trim();
        cookies.set(name, value);
      }
    }
  }
  return cookies;
}

/**
 * Performs automatic admin login:
 * 1. GET /api/admin/csrf → gets csrf_token cookie + csrfToken value
 * 2. POST /api/admin/login → gets pagayo_session cookie
 */
async function performAdminLogin(): Promise<boolean> {
  console.log("🔐 Automatisch inloggen...\n");

  // Step 1: Get CSRF token
  const csrfResponse = await fetch(`${TENANT_URL}/api/admin/csrf`, {
    headers: { Accept: "application/json" },
  });

  if (!csrfResponse.ok) {
    console.error(`   ❌ CSRF ophalen mislukt: ${csrfResponse.status}`);
    return false;
  }

  const csrfCookies = extractCookies(csrfResponse);
  const csrfCookieValue = csrfCookies.get("csrf_token");
  const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
  csrfToken = csrfBody.csrfToken || "";

  if (csrfCookieValue) {
    csrfCookie = `csrf_token=${csrfCookieValue}`;
  }

  console.log(`   ✅ CSRF token ontvangen`);

  // Step 2: Login
  const loginCookies: string[] = [];
  if (csrfCookie) loginCookies.push(csrfCookie);
  // Include existing session cookie if already present
  if (sessionCookie) loginCookies.push(sessionCookie);

  const loginResponse = await fetch(`${TENANT_URL}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
      ...(loginCookies.length > 0 ? { Cookie: loginCookies.join("; ") } : {}),
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!loginResponse.ok) {
    const errorBody = await loginResponse.text();
    console.error(
      `   ❌ Login mislukt: ${loginResponse.status} — ${errorBody}`,
    );
    return false;
  }

  const loginSetCookies = extractCookies(loginResponse);
  const newSession = loginSetCookies.get("pagayo_session");
  if (newSession) {
    sessionCookie = `pagayo_session=${newSession}`;
  }

  // Also update CSRF cookie if it was refreshed
  const newCsrf = loginSetCookies.get("csrf_token");
  if (newCsrf) {
    csrfCookie = `csrf_token=${newCsrf}`;
  }

  const loginBody = (await loginResponse.json()) as {
    success?: boolean;
    user?: { email?: string };
    csrfToken?: string;
  };
  if (loginBody.csrfToken) {
    csrfToken = loginBody.csrfToken;
  }

  console.log(
    `   ✅ Ingelogd als ${loginBody.user?.email || ADMIN_EMAIL} (admin sessie)`,
  );
  console.log();

  return true;
}

// ===========================================
// MAIN
// ===========================================

async function main(): Promise<void> {
  console.log(`\n🔍 Pagayo API Health Scanner`);
  console.log(`   Target: ${TENANT_URL}\n`);

  // Auto-login als credentials zijn meegegeven
  if (ADMIN_EMAIL && ADMIN_PASSWORD && !sessionCookie) {
    const loginOk = await performAdminLogin();
    if (!loginOk) {
      console.error(
        "⚠️  Login mislukt — scan gaat door zonder sessie (alleen route-check)\n",
      );
    }
  } else if (sessionCookie) {
    console.log("🔑 Handmatige sessie cookie meegegeven\n");
  } else {
    console.log(
      "⚠️  Geen login credentials — alleen route-check (401s verwacht)\n",
    );
    console.log(
      '   Tip: ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npx tsx scripts/api-health-scan.ts\n',
    );
  }

  console.log(`📋 Scanning ${ENDPOINTS.length} endpoints...\n`);

  // Scan sequentieel (niet parallel — voorkom rate limiting)
  const results: ScanResult[] = [];
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(
      `  ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(55)}`,
    );
    const result = await scanEndpoint(endpoint);
    results.push(result);

    const icon =
      result.status === 0
        ? "💀"
        : !result.ok && result.status === 500
          ? "❌"
          : !result.ok && result.status === 404
            ? "⚠️ "
            : result.status === 401
              ? "🔒"
              : result.ok
                ? "✅"
                : "❓";
    console.log(`${icon} ${result.status} (${result.duration}ms)`);
  }

  printReport(results);

  // Exit code: 1 als er ECHTE fouten zijn (niet-OK resultaten)
  const critical = results.filter((r) => !r.ok);
  process.exit(critical.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Scanner crashed:", err);
  process.exit(2);
});
