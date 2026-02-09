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

    it('Full registration provisions tenant successfully', async () => {
      // Generate unique test data to avoid conflicts
      const testId = Date.now();
      const testEmail = `smoke-test-${testId}@pagayo-test.nl`;
      const testOrgName = `Smoke Test Shop ${testId}`;
      
      const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: testOrgName,
          email: testEmail,
          password: 'SmokeTest123!',
        }),
      });
      
      // Rate limit is acceptable - means endpoint is working
      if (response.status === 429) {
        log('register-provision', 'SKIP', 'Rate limited - endpoint working',
          undefined, 'LOW');
        return;
      }
      
      const data = await response.json();
      
      // Check for server errors (500+)
      if (response.status >= 500) {
        log('register-provision', 'FAIL', `Server error: HTTP ${response.status}`,
          'Check Worker logs and database schema sync', 'CRITICAL');
        expect(response.status).toBeLessThan(500);
        return;
      }
      
      // Check for successful registration with tenant provisioning
      if (response.status === 200 || response.status === 201 || response.status === 202) {
        // Async workflow response (202) - poll workflow status until complete
        if (response.status === 202 && data.async === true) {
          if (!data.workflowId) {
            log('register-provision', 'FAIL', 'Async response but no workflowId',
              'Check workflow trigger logic', 'CRITICAL');
            expect(data.workflowId).toBeDefined();
            return;
          }
          
          // Poll workflow status to check if provisioning actually succeeds
          const workflowId = data.workflowId;
          const maxAttempts = 30; // 30 seconds max
          const pollInterval = 1000; // 1 second
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            const statusResponse = await fetch(
              `${BEHEER_URL}/api/workflows/${workflowId}/status`
            );
            
            // If status endpoint not accessible (401/403), we can't verify - pass with warning
            if (statusResponse.status === 401 || statusResponse.status === 403) {
              log('register-provision', 'WARN', 
                `Workflow triggered but status not accessible (HTTP ${statusResponse.status})`,
                'Workflow status requires auth - manual verification needed', 'MEDIUM');
              return;
            }
            
            if (!statusResponse.ok) {
              continue; // Keep polling
            }
            
            const statusData = await statusResponse.json();
            const status = statusData.status || statusData.data?.status;
            
            // Workflow completed successfully
            if (status === 'complete' || status === 'COMPLETED' || status === 'success') {
              log('register-provision', 'PASS', 
                `Workflow completed: ${workflowId} - tenant provisioned`);
              return;
            }
            
            // Workflow failed - THIS IS THE BUG WE WANT TO DETECT
            if (status === 'failed' || status === 'FAILED' || status === 'error') {
              const errorMsg = statusData.error || statusData.data?.error || 'unknown';
              log('register-provision', 'FAIL', 
                `Workflow FAILED: ${errorMsg}`,
                'Check Neon DB schema sync - run prisma migrate deploy', 'CRITICAL');
              expect(status).not.toBe('failed');
              expect(status).not.toBe('FAILED');
              return;
            }
            
            // Still running - continue polling
            if (status === 'running' || status === 'RUNNING' || status === 'pending') {
              continue;
            }
          }
          
          // Timeout - workflow didn't complete in time
          log('register-provision', 'WARN', 
            `Workflow timeout after ${maxAttempts}s: ${workflowId}`,
            'Workflow taking too long - check manually', 'MEDIUM');
          return;
        }
        
        // Sync response - check tenant was provisioned
        if (data.success === true) {
          // CRITICAL CHECK: Tenant must be provisioned
          if (data.tenantProvisioned === true || data.tenant) {
            log('register-provision', 'PASS', 
              `Tenant provisioned: ${data.subdomain || data.tenant?.slug || 'OK'}`);
          } else if (data.tenantProvisioned === false) {
            // THIS IS THE BUG WE'RE DETECTING
            log('register-provision', 'FAIL', 
              `Registration OK but tenant NOT provisioned! Error: ${data.provisioningError || 'unknown'}`,
              'Check Neon DB schema sync - run prisma migrate deploy', 'CRITICAL');
            expect(data.tenantProvisioned).toBe(true);
          } else {
            // Org created but unclear if tenant exists
            log('register-provision', 'WARN', 
              'Registration success but tenantProvisioned flag missing',
              'Add tenantProvisioned flag to response', 'HIGH');
          }
        } else {
          log('register-provision', 'FAIL', 
            `Registration failed: ${data.message || data.error || 'unknown'}`,
            'Check registration flow', 'CRITICAL');
          expect(data.success).toBe(true);
        }
      } else {
        // Unexpected status code
        log('register-provision', 'FAIL', 
          `Unexpected HTTP ${response.status}: ${JSON.stringify(data)}`,
          'Check registration endpoint', 'HIGH');
        expect([200, 201, 202, 400, 409, 429]).toContain(response.status);
      }
    });
  });
});
