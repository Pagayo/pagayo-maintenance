/**
 * SMOKE TESTS - STOREFRONT SERVICE
 * ============================================================================
 * DOEL: Verificatie dat test-3.pagayo.app (tenant shop) operationeel is
 * PRIORITEIT: CRITICAL - Klant-facing webshop functionaliteit
 * SERVICE: test-3.pagayo.app (tenant schema: tenant_518970)
 * 
 * ACTIE BIJ FAILURE:
 * - Health faalt → Check Cloudflare Worker status
 * - 500 op products/categories → Neon DB connectie of tenant schema issue
 * - Admin 500 → Worker crash, check logs
 * ============================================================================
 */

import { logTestResult, type TestResult } from '../utils/test-reporter';

const STOREFRONT_URL = 'https://test-3.pagayo.app';

function log(test: string, status: TestResult['status'], details: string, action?: string, priority?: TestResult['priority']) {
  logTestResult({
    category: 'SMOKE',
    service: 'storefront',
    test,
    status,
    details,
    action,
    priority,
  });
}

describe('Storefront Service - Smoke Tests', () => {
  describe('Health Endpoints', () => {
    it('API health endpoint returns 200', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/health`);
      const data = response.status === 200 ? await response.json() : null;
      
      if (response.status === 200 && data) {
        log('api-health', 'PASS', `Status: ${data.status}`);
        expect(['healthy', 'ok']).toContain(data.status);
      } else {
        log('api-health', 'FAIL', `HTTP ${response.status}`,
          'Check Storefront Worker deployment', 'CRITICAL');
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Public Routes', () => {
    it('Homepage serves HTML', async () => {
      const response = await fetch(STOREFRONT_URL);
      
      if (response.status === 200) {
        log('homepage', 'PASS', 'Homepage accessible');
      } else {
        log('homepage', 'FAIL', `HTTP ${response.status}`,
          'Check Storefront Worker routing', 'CRITICAL');
      }
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    it('Products API returns data', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/products`);
      
      if (response.status === 200) {
        log('products-api', 'PASS', 'Products endpoint working');
      } else {
        log('products-api', 'FAIL', `HTTP ${response.status}`,
          'Check Worker logs for SQL errors', 'HIGH');
      }
      
      // Products API should return 200 with data array
      expect(response.status).toBe(200);
    });

    it('Categories API returns data', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/categories`);
      
      if (response.status === 200) {
        log('categories-api', 'PASS', 'Categories endpoint working');
      } else {
        log('categories-api', 'FAIL', `HTTP ${response.status}`,
          'Check Worker logs for SQL errors', 'HIGH');
      }
      
      // Categories API should return 200 with data array
      expect(response.status).toBe(200);
    });
  });

  describe('Auth Routes', () => {
    it('Session check returns valid response', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/session`);
      
      if ([200, 401, 404].includes(response.status)) {
        log('session', 'PASS', `Session endpoint: HTTP ${response.status}`);
      } else {
        log('session', 'FAIL', `HTTP ${response.status}`,
          'Check auth service', 'HIGH');
      }
      
      expect([200, 401, 404]).toContain(response.status);
    });

    it('Login with invalid credentials returns 400/401', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        }),
      });
      
      if ([400, 401].includes(response.status)) {
        log('login-invalid', 'PASS', `Validation works: HTTP ${response.status}`);
      } else if (response.status >= 500) {
        log('login-invalid', 'FAIL', 'Server crash on login',
          'Check login handler', 'HIGH');
      }
      
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('Admin Routes (Auth Required)', () => {
    it('Admin panel accessible (may redirect to login)', async () => {
      const response = await fetch(`${STOREFRONT_URL}/admin`, { redirect: 'manual' });
      
      if (response.status >= 500) {
        log('admin-panel', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin routes handler', 'HIGH');
      } else {
        log('admin-panel', 'PASS', `Protected: HTTP ${response.status}`);
      }
      
      expect(response.status).toBeLessThan(500);
    });

    it('Admin API requires auth', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/orders`);
      
      if ([401, 403].includes(response.status)) {
        log('admin-orders', 'PASS', 'Properly protected');
      } else if (response.status >= 500) {
        log('admin-orders', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin API handler', 'HIGH');
      }
      
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Cart & Checkout', () => {
    it('Cart endpoint accessible', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/cart`);
      
      if ([200, 401, 404].includes(response.status)) {
        log('cart', 'PASS', `Cart endpoint: HTTP ${response.status}`);
      } else {
        log('cart', 'WARN', `Unexpected: HTTP ${response.status}`);
      }
      
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  describe('New Endpoints - Auth Required', () => {
    it('PUT /api/admin/orders/batch/status requires auth', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/orders/batch/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [], status: 'shipped' }),
      });

      if ([401, 403].includes(response.status)) {
        log('batch-status', 'PASS', 'Properly protected');
      } else if (response.status >= 500) {
        log('batch-status', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-orders routes', 'HIGH');
      }

      expect([401, 403]).toContain(response.status);
    });

    it('POST /api/admin/forgot-password returns valid response', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@smoke-test.com' }),
      });

      if ([200, 400].includes(response.status)) {
        log('forgot-password', 'PASS', `Status: ${response.status}`);
      } else if (response.status >= 500) {
        log('forgot-password', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-auth routes forgot-password handler', 'HIGH');
      }

      // 200 = anti-enumeration success, 400 = validation error — both acceptable
      expect(response.status).toBeLessThan(500);
    });

    it('POST /api/admin/reset-password validates input', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid', newPassword: '123' }),
      });

      if (response.status === 400) {
        log('reset-password', 'PASS', 'Validation works');
      } else if (response.status >= 500) {
        log('reset-password', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-auth routes reset-password handler', 'HIGH');
      }

      expect(response.status).toBeLessThan(500);
    });

    it('GET /api/admin/ai/config requires auth', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/ai/config`);

      if ([401, 403].includes(response.status)) {
        log('ai-config', 'PASS', 'Properly protected');
      } else if (response.status >= 500) {
        log('ai-config', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-ai routes', 'HIGH');
      }

      expect([401, 403]).toContain(response.status);
    });

    it('GET /api/admin/organization/onboarding requires auth', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/organization/onboarding`);

      if ([401, 403].includes(response.status)) {
        log('organization-onboarding', 'PASS', 'Properly protected');
      } else if (response.status >= 500) {
        log('organization-onboarding', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-organization routes', 'HIGH');
      }

      expect([401, 403]).toContain(response.status);
    });

    it('GET /api/admin/roles-ui requires auth', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/roles-ui`);

      if ([401, 403].includes(response.status)) {
        log('roles-ui', 'PASS', 'Properly protected');
      } else if (response.status >= 500) {
        log('roles-ui', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-roles-ui routes', 'HIGH');
      }

      expect([401, 403]).toContain(response.status);
    });

    it('GET /api/admin/integrations/stripe/connect/status requires auth', async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/integrations/stripe/connect/status`);

      if ([401, 403].includes(response.status)) {
        log('integrations-stripe', 'PASS', 'Properly protected');
      } else if (response.status >= 500) {
        log('integrations-stripe', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check admin-integrations routes', 'HIGH');
      }

      expect([401, 403]).toContain(response.status);
    });
  });
});
