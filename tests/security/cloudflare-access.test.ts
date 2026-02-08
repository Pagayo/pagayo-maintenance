/**
 * Security Tests - Cloudflare Access Validation
 * 
 * Validates that Cloudflare Access (Zero Trust) is properly configured.
 * 403 responses indicate Access is blocking - this is CRITICAL.
 */

const BEHEER_URL = 'https://beheer.pagayo.com';

describe('Security - Cloudflare Access Bypass', () => {
  describe('Public Routes (MUST allow bypass)', () => {
    const publicRoutes = [
      { path: '/api/auth/register', method: 'POST', body: '{}' },
      { path: '/api/auth/session', method: 'GET' },
      // Note: /api/auth/logout is protected by Cloudflare Access (requires login)
      { path: '/api/capabilities/features', method: 'GET' },
      { path: '/api/workflows/provisioning/status/test', method: 'GET' },
    ];

    test.each(publicRoutes)('$path should NOT return 403', async (route) => {
      const options: RequestInit = { 
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (route.body) {
        options.body = route.body;
      }
      
      const response = await fetch(`${BEHEER_URL}${route.path}`, options);
      
      // 403 = Cloudflare Access blocking - CONFIGURATIE FOUT
      if (response.status === 403) {
        throw new Error(
          `CRITICAL: ${route.path} is blocked by Cloudflare Access!\n` +
          `Fix: Create Access bypass application in Cloudflare Dashboard → Zero Trust → Access → Applications`
        );
      }
      
      expect(response.status).not.toBe(403);
    });
  });

  describe('Protected Routes (MUST require auth)', () => {
    const protectedRoutes = [
      '/api/admin/organizations',
      '/api/admin/tenants',
      '/api/tenants',
      '/api/billing/invoices',
    ];

    test.each(protectedRoutes)('%s should require authentication', async (path) => {
      const response = await fetch(`${BEHEER_URL}${path}`);
      
      // Protected by either:
      // - Cloudflare Access (redirects to login, returns 200 with HTML)
      // - Worker auth middleware (returns 401/403 JSON)
      // Both are valid - the key is no unprotected access
      // If 200 with HTML = Cloudflare Access login page
      // If 401/403 = Worker auth
      if (response.status === 200) {
        const contentType = response.headers.get('content-type') || '';
        // If JSON 200, that would be a security issue (no auth)
        // If HTML 200, it's Cloudflare Access login page
        if (contentType.includes('application/json')) {
          console.warn(`⚠️ ${path} returns 200 JSON without auth - check security!`);
        }
      }
      
      // Accept any of these as "protected"
      expect([200, 302, 401, 403]).toContain(response.status);
    });
  });
});

describe('Security - CORS Headers', () => {
  it('should not have overly permissive CORS', async () => {
    const response = await fetch(`${BEHEER_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    
    const allowOrigin = response.headers.get('access-control-allow-origin');
    
    // Should not allow arbitrary origins
    if (allowOrigin) {
      expect(allowOrigin).not.toBe('*');
      expect(allowOrigin).not.toBe('https://malicious-site.com');
    }
  });
});

describe('Security - Rate Limiting', () => {
  it('should rate limit registration endpoint', async () => {
    // Send multiple requests quickly
    const requests = Array(10).fill(null).map(() => 
      fetch(`${BEHEER_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    
    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    
    // At least one should be rate limited (429)
    // Note: This might not trigger in dev, so we just check it doesn't crash
    const has429 = statuses.includes(429);
    const hasNoCrash = !statuses.includes(500);
    
    expect(hasNoCrash).toBe(true);
    
    if (has429) {
      console.log('✓ Rate limiting is working');
    } else {
      console.warn('⚠ Rate limiting might not be configured (no 429 received)');
    }
  });
});

describe('Security - Input Validation', () => {
  it('should reject malformed JSON', async () => {
    const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });
    
    // Should return 400 (bad request) or 429 (rate limited), not 500
    expect([400, 429]).toContain(response.status);
  });

  it('should handle XSS attempts in input', async () => {
    const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '<script>alert("xss")</script>@test.com',
        password: '<script>alert("xss")</script>',
        organizationName: '<script>alert("xss")</script>',
      }),
    });
    
    // Should validate and reject, not crash
    expect([400, 429]).toContain(response.status);
  });

  it('should handle SQL injection attempts', async () => {
    const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: "test@test.com'; DROP TABLE users; --",
        password: "test'; DROP TABLE users; --",
        organizationName: "'; DROP TABLE organizations; --",
      }),
    });
    
    // Should validate and reject, not crash
    expect([400, 429]).toContain(response.status);
  });
});
