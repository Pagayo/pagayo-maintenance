/**
 * SMOKE TESTS - INFRASTRUCTURE
 * ============================================================================
 * DOEL: Verificatie van DNS, SSL, en routing voor alle Pagayo domeinen
 * PRIORITEIT: CRITICAL - Als deze falen, werkt NIETS
 * SCOPE: Alle productie domeinen
 *
 * ACTIE BIJ FAILURE:
 * - DNS faalt → Check Cloudflare DNS records
 * - SSL faalt → Check Cloudflare SSL/TLS instellingen
 * - Routing faalt → Check Workers/Pages deployment
 * - CF Headers ontbreken → Check Cloudflare proxy status
 * ============================================================================
 */

import { execSync } from "child_process";
import { logTestResult, type TestResult } from "../utils/test-reporter";
import { SERVICE_DOMAINS } from "../utils/test-config";

const DOMAINS = {
  beheer: "beheer.pagayo.com",
  app: "app.pagayo.com",
  api: "api.pagayo.com",
  www: "www.pagayo.com",
  storefront: SERVICE_DOMAINS.storefront,
};

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "infrastructure",
    test,
    status,
    details,
    action,
    priority,
  });
}

function checkDNS(domain: string): boolean {
  try {
    execSync(`host ${domain}`, { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getSSLExpiry(domain: string): number | null {
  try {
    const output = execSync(
      `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep "notAfter" | cut -d= -f2`,
      { encoding: "utf-8", stdio: "pipe" },
    ).trim();

    if (!output) return null;

    const expiryDate = new Date(output);
    const now = new Date();
    return Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  } catch {
    return null;
  }
}

describe("Infrastructure - DNS Resolution", () => {
  test.each(Object.entries(DOMAINS))("%s DNS resolves", (name, domain) => {
    const resolves = checkDNS(domain);

    if (resolves) {
      log(`dns-${name}`, "PASS", `${domain} resolves`);
    } else {
      log(
        `dns-${name}`,
        "FAIL",
        `${domain} DNS failure`,
        "Check Cloudflare DNS records",
        "CRITICAL",
      );
    }

    expect(resolves).toBe(true);
  });
});

describe("Infrastructure - SSL Certificates", () => {
  test.each(Object.entries(DOMAINS))("%s SSL valid", (name, domain) => {
    const daysUntilExpiry = getSSLExpiry(domain);

    if (daysUntilExpiry === null) {
      log(
        `ssl-${name}`,
        "FAIL",
        `${domain} SSL check failed`,
        "Check SSL/TLS settings in Cloudflare",
        "CRITICAL",
      );
    } else if (daysUntilExpiry <= 7) {
      log(
        `ssl-${name}`,
        "FAIL",
        `${domain} SSL expires in ${daysUntilExpiry} days!`,
        "URGENT: SSL renewal needed",
        "CRITICAL",
      );
    } else if (daysUntilExpiry <= 30) {
      log(
        `ssl-${name}`,
        "WARN",
        `${domain} SSL expires in ${daysUntilExpiry} days`,
        "Monitor SSL renewal (auto-renew should handle)",
      );
    } else {
      log(
        `ssl-${name}`,
        "PASS",
        `${domain} SSL valid for ${daysUntilExpiry} days`,
      );
    }

    expect(daysUntilExpiry).not.toBeNull();
    expect(daysUntilExpiry).toBeGreaterThan(7);
  });
});

describe("Infrastructure - HTTPS Reachability", () => {
  test.each(Object.entries(DOMAINS))(
    "%s HTTPS reachable",
    async (name, domain) => {
      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        redirect: "follow",
      });

      if (response.status < 600) {
        log(
          `https-${name}`,
          "PASS",
          `${domain} reachable (HTTP ${response.status})`,
        );
      } else {
        log(
          `https-${name}`,
          "FAIL",
          `${domain} unreachable`,
          "Check Cloudflare and origin server",
          "CRITICAL",
        );
      }

      expect(response.status).toBeLessThan(600);
    },
  );
});

describe("Infrastructure - Cloudflare Headers", () => {
  it("beheer.pagayo.com has CF headers", async () => {
    const response = await fetch(`https://${DOMAINS.beheer}/api/health`);
    const hasCF = response.headers.has("cf-ray");

    if (hasCF) {
      log(
        "cf-headers-beheer",
        "PASS",
        `cf-ray: ${response.headers.get("cf-ray")}`,
      );
    } else {
      log(
        "cf-headers-beheer",
        "FAIL",
        "Missing cf-ray header",
        "Check Cloudflare proxy status (orange cloud)",
        "HIGH",
      );
    }

    expect(hasCF).toBe(true);
  });

  it("www.pagayo.com has CF headers", async () => {
    const response = await fetch(`https://${DOMAINS.www}`);
    const hasCF = response.headers.has("cf-ray");

    if (hasCF) {
      log(
        "cf-headers-www",
        "PASS",
        `cf-ray: ${response.headers.get("cf-ray")}`,
      );
    } else {
      log(
        "cf-headers-www",
        "FAIL",
        "Missing cf-ray header",
        "Check Cloudflare proxy status",
        "HIGH",
      );
    }

    expect(hasCF).toBe(true);
  });
});

describe("Infrastructure - Critical Routing", () => {
  it("app.pagayo.com routes to Pages", async () => {
    const response = await fetch(`https://${DOMAINS.app}`);

    if (response.status === 200) {
      log("routing-app", "PASS", "app.pagayo.com → Cloudflare Pages");
    } else {
      log(
        "routing-app",
        "FAIL",
        `HTTP ${response.status}`,
        "Check app.pagayo.com Pages deployment",
        "CRITICAL",
      );
    }

    expect(response.status).toBe(200);
  });

  it("beheer.pagayo.com routes to Worker", async () => {
    const response = await fetch(`https://${DOMAINS.beheer}/api/health`, {
      redirect: "follow",
    });

    if (response.status === 200) {
      log("routing-beheer", "PASS", "beheer.pagayo.com → Worker");
    } else {
      log(
        "routing-beheer",
        "FAIL",
        `HTTP ${response.status}`,
        "Check Beheer Worker deployment",
        "CRITICAL",
      );
    }

    expect(response.status).toBe(200);
  });

  it("*.pagayo.app routes to Storefront Worker", async () => {
    const response = await fetch(`https://${DOMAINS.storefront}/api/health`);

    if (response.status === 200) {
      log("routing-storefront", "PASS", "*.pagayo.app → Storefront Worker");
    } else {
      log(
        "routing-storefront",
        "FAIL",
        `HTTP ${response.status}`,
        "Check Storefront Worker deployment",
        "CRITICAL",
      );
    }

    expect(response.status).toBe(200);
  });
});
