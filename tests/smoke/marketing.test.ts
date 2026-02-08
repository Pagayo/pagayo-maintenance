/**
 * SMOKE TESTS - MARKETING WEBSITE
 * ============================================================================
 * DOEL: Verificatie dat www.pagayo.com operationeel is
 * PRIORITEIT: HIGH - Publiek gezicht van Pagayo
 * SERVICE: www.pagayo.com (Cloudflare Pages)
 * 
 * ACTIE BIJ FAILURE:
 * - 404 op pages → Check Cloudflare Pages deployment
 * - Redirect issues → Check CF DNS / Page Rules
 * - Missing sitemap/robots → Rebuild Astro site
 * ============================================================================
 */

import { logTestResult, type TestResult } from '../utils/test-reporter';

const MARKETING_URL = 'https://www.pagayo.com';

function log(test: string, status: TestResult['status'], details: string, action?: string, priority?: TestResult['priority']) {
  logTestResult({
    category: 'SMOKE',
    service: 'marketing',
    test,
    status,
    details,
    action,
    priority,
  });
}

describe('Marketing Website - Smoke Tests', () => {
  describe('Core Pages', () => {
    it('Homepage returns 200', async () => {
      const response = await fetch(MARKETING_URL);
      
      if (response.status === 200) {
        log('homepage', 'PASS', 'Homepage accessible');
      } else {
        log('homepage', 'FAIL', `HTTP ${response.status}`,
          'Check Cloudflare Pages deployment', 'CRITICAL');
      }
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    it('Dutch homepage /nl returns 200', async () => {
      const response = await fetch(`${MARKETING_URL}/nl`);
      
      if (response.status === 200) {
        log('nl-homepage', 'PASS', 'Dutch homepage accessible');
      } else {
        log('nl-homepage', 'FAIL', `HTTP ${response.status}`,
          'Check /nl route in Astro', 'HIGH');
      }
      
      expect(response.status).toBe(200);
    });

    it('Pricing page /nl/prijzen returns 200', async () => {
      const response = await fetch(`${MARKETING_URL}/nl/prijzen`);
      
      if (response.status === 200) {
        log('pricing', 'PASS', 'Pricing page accessible');
      } else {
        log('pricing', 'FAIL', `HTTP ${response.status}`,
          'Check pricing page in Astro', 'HIGH');
      }
      
      expect(response.status).toBe(200);
    });

    it('About page /nl/over-ons returns 200', async () => {
      const response = await fetch(`${MARKETING_URL}/nl/over-ons`);
      
      if (response.status === 200) {
        log('about', 'PASS', 'About page accessible');
      } else {
        log('about', 'FAIL', `HTTP ${response.status}`,
          'Check about page in Astro', 'MEDIUM');
      }
      
      expect(response.status).toBe(200);
    });
  });

  describe('SEO & Performance', () => {
    it('robots.txt exists', async () => {
      const response = await fetch(`${MARKETING_URL}/robots.txt`);
      
      if (response.status === 200) {
        log('robots', 'PASS', 'robots.txt exists');
      } else {
        log('robots', 'FAIL', `HTTP ${response.status}`,
          'Add robots.txt to Astro public/', 'MEDIUM');
      }
      
      expect(response.status).toBe(200);
    });

    it('sitemap.xml exists', async () => {
      const response = await fetch(`${MARKETING_URL}/sitemap.xml`);
      
      if (response.status === 200) {
        log('sitemap', 'PASS', 'sitemap.xml exists');
      } else {
        log('sitemap', 'WARN', `HTTP ${response.status}`,
          'Check sitemap generation in Astro config');
      }
      
      // Sitemap kan ook elders staan
      expect([200, 301, 302]).toContain(response.status);
    });

    it('Cache headers present', async () => {
      const response = await fetch(MARKETING_URL);
      const hasCache = response.headers.has('cache-control');
      
      if (hasCache) {
        log('cache', 'PASS', `Cache-Control: ${response.headers.get('cache-control')}`);
      } else {
        log('cache', 'WARN', 'No cache-control header',
          'Configure cache in Cloudflare Pages');
      }
      
      expect(hasCache).toBe(true);
    });
  });

  describe('Redirects', () => {
    it('pagayo.com redirects or serves correctly', async () => {
      const response = await fetch('https://pagayo.com', { redirect: 'manual' });
      
      if ([200, 301, 302, 308].includes(response.status)) {
        log('apex-redirect', 'PASS', `HTTP ${response.status}`);
      } else {
        log('apex-redirect', 'FAIL', `HTTP ${response.status}`,
          'Check CF DNS for apex domain', 'MEDIUM');
      }
      
      expect([200, 301, 302, 308]).toContain(response.status);
    });
  });

  describe('Registration Links', () => {
    it('app.pagayo.com/register works', async () => {
      const response = await fetch('https://app.pagayo.com/register');
      
      if (response.status === 200) {
        log('register-link', 'PASS', 'Registration page accessible');
      } else {
        log('register-link', 'FAIL', `HTTP ${response.status}`,
          'Check app.pagayo.com Pages deployment', 'CRITICAL');
      }
      
      expect(response.status).toBe(200);
    });
  });
});
