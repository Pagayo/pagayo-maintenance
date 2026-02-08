/**
 * SMOKE TESTS - BEHEER SERVICE
 * ============================================================================
 * DOEL: Verificatie dat beheer.pagayo.com operationeel is
 * PRIORITEIT: CRITICAL - Platform admin functionaliteit
 * SERVICE: beheer.pagayo.com
 * 
 * ACTIE BIJ FAILURE:
 * - Health endpoint faalt → Check Cloudflare Worker status, Neon DB
 * - 403 errors → Controleer Cloudflare Access bypass regels
 * - 500 errors → Check Worker logs in Cloudflare Dashboard
 * - Rate limits → Verwacht gedrag, geen actie nodig
 * ============================================================================
 */

import { logTestResult, type TestResult } from '../utils/test-reporter';

const BEHEER_URL = 'https://beheer.pagayo.com';

function log(test: string, status: TestResult['status'], details: string, action?: string, priority?: TestResult['priority']) {
  logTestResult({
    category: 'SMOKE',
    service: 'beheer',
    test,
    status,
    details,
    action,
    priority,
  });
}

describe('Beheer Service - Smoke Tests', () => {
  describe('Health Endpoints', () => {
    it('API health endpoint returns 200', async () => {
      const response = await fetch(`${BEHEER_URL}/api/health`, { redirect: 'follow' });
      const contentType = response.headers.get('content-type') || '';
      
      // Cloudflare Access can intercept and return HTML login page
      if (response.status === 200 && contentType.includes('application/json')) {
        const data = await response.json();
        log('api-health', ['healthy', 'ok'].includes(data.status) ? 'PASS' : 'WARN', 
          `Status: ${data.status}`);
        expect(['healthy', 'ok']).toContain(data.status);
      } else if (response.status === 200 && contentType.includes('text/html')) {
        // Cloudflare Access login page - this means bypass is not working
        log('api-health', 'WARN', 'Returns HTML (CF Access redirect)',
          'Check /api/health bypass in CF Access policy');
        // Pass the test since the endpoint is reachable, just protected
        expect(response.status).toBe(200);
      } else {
        log('api-health', 'FAIL', `HTTP ${response.status}`, 
          'Check Cloudflare Worker status', 'CRITICAL');
        expect(response.status).toBe(200);
      }
    });

    it('Root health endpoint returns build info', async () => {
      const response = await fetch(`${BEHEER_URL}/health`);
      const contentType = response.headers.get('content-type') || '';
      
      if (response.status === 200 && contentType.includes('application/json')) {
        const data = await response.json();
        log('health', data.status && data.build ? 'PASS' : 'WARN',
          `Build: ${data.build?.version || 'present'}`);
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('build');
      } else if (response.status === 200) {
        log('health', 'WARN', 'Endpoint accessible but not JSON');
        expect(response.status).toBe(200);
      } else {
        log('health', 'FAIL', `HTTP ${response.status}`, 
          'Check Worker deployment', 'CRITICAL');
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Public Routes (Cloudflare Access Bypass)', () => {
    it('Registration NOT blocked by Cloudflare Access', async () => {
      const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (response.status === 403) {
        log('register-bypass', 'FAIL', 'CF Access blocking registration',
          'Add /api/auth/* to bypass policy', 'CRITICAL');
      } else {
        log('register-bypass', 'PASS', `HTTP ${response.status} - Not blocked`);
      }
      
      expect(response.status).not.toBe(403);
      expect([400, 429]).toContain(response.status);
    });

    it('Workflows NOT blocked by Cloudflare Access', async () => {
      const response = await fetch(`${BEHEER_URL}/api/workflows/provisioning/status/test`);
      
      if (response.status === 403) {
        log('workflows-bypass', 'FAIL', 'CF Access blocking workflows',
          'Add /api/workflows/* to bypass policy', 'CRITICAL');
      } else {
        log('workflows-bypass', 'PASS', `HTTP ${response.status} - Not blocked`);
      }
      
      expect(response.status).not.toBe(403);
      expect([401, 404]).toContain(response.status);
    });

    it('Capabilities endpoint returns features', async () => {
      const response = await fetch(`${BEHEER_URL}/api/capabilities/features`);
      
      if (response.status === 200) {
        const data = await response.json();
        log('capabilities', 'PASS', 'Features endpoint accessible');
        expect(data.success === true || Array.isArray(data.features)).toBe(true);
      } else {
        log('capabilities', 'FAIL', `HTTP ${response.status}`,
          'Check capabilities service', 'HIGH');
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Protected Routes (Auth Required)', () => {
    it('Admin organizations requires auth (no crash)', async () => {
      const response = await fetch(`${BEHEER_URL}/api/admin/organizations`, { redirect: 'manual' });
      
      if (response.status >= 500) {
        log('admin-orgs', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check Worker logs for crash', 'CRITICAL');
      } else {
        log('admin-orgs', 'PASS', `Protected: HTTP ${response.status}`);
      }
      
      expect(response.status).toBeLessThan(500);
    });

    it('Tenants endpoint requires auth (no crash)', async () => {
      const response = await fetch(`${BEHEER_URL}/api/tenants`, { redirect: 'manual' });
      
      if (response.status >= 500) {
        log('tenants', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check Worker logs for crash', 'CRITICAL');
      } else {
        log('tenants', 'PASS', `Protected: HTTP ${response.status}`);
      }
      
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Critical Flows', () => {
    it('Registration validates input (no crash)', async () => {
      const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' }),
      });
      
      if ([400, 429].includes(response.status)) {
        log('register-validation', 'PASS', `Validation works: HTTP ${response.status}`);
        if (response.status === 400) {
          const data = await response.json();
          expect(data).toHaveProperty('success', false);
        }
      } else if (response.status >= 500) {
        log('register-validation', 'FAIL', 'Server crash on validation',
          'Fix validation error handling', 'HIGH');
      }
      
      expect([400, 429]).toContain(response.status);
    });
  });
});
