/**
 * Test Utilities - AI-Readable Output
 * 
 * Provides consistent, structured output that AI agents can parse and act on.
 */

export interface TestResult {
  category: 'SMOKE' | 'SECURITY' | 'CONTRACT' | 'INTEGRATION' | 'PERFORMANCE';
  service: string;
  test: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
  details: string;
  action?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const results: TestResult[] = [];

/**
 * Log a test result in AI-readable format
 */
export function logTestResult(result: TestResult): void {
  results.push(result);
  
  const emoji = {
    PASS: '✓',
    WARN: '⚠',
    FAIL: '✗',
    SKIP: '○',
  }[result.status];
  
  const priority = result.priority ? `[${result.priority}]` : '';
  
  console.log(`[${result.category}] ${emoji} ${result.service}/${result.test}: ${result.details} ${priority}`);
  
  if (result.action && result.status !== 'PASS') {
    console.log(`   → ACTION: ${result.action}`);
  }
}

/**
 * Generate summary for AI consumption
 */
export function generateSummary(): void {
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY FOR AI AGENT');
  console.log('='.repeat(70));
  console.log(`PASSED: ${passed} | WARNINGS: ${warned} | FAILED: ${failed} | SKIPPED: ${skipped}`);
  
  // Group failures by priority
  const criticalFailures = results.filter(r => r.status === 'FAIL' && r.priority === 'CRITICAL');
  const highFailures = results.filter(r => r.status === 'FAIL' && r.priority === 'HIGH');
  const otherFailures = results.filter(r => r.status === 'FAIL' && !['CRITICAL', 'HIGH'].includes(r.priority || ''));
  
  if (criticalFailures.length > 0) {
    console.log('\n🚨 CRITICAL FAILURES (fix immediately):');
    criticalFailures.forEach(r => {
      console.log(`   - ${r.service}/${r.test}: ${r.details}`);
      if (r.action) console.log(`     ACTION: ${r.action}`);
    });
  }
  
  if (highFailures.length > 0) {
    console.log('\n⚠️ HIGH PRIORITY FAILURES:');
    highFailures.forEach(r => {
      console.log(`   - ${r.service}/${r.test}: ${r.details}`);
      if (r.action) console.log(`     ACTION: ${r.action}`);
    });
  }
  
  if (otherFailures.length > 0) {
    console.log('\n📋 OTHER FAILURES:');
    otherFailures.forEach(r => {
      console.log(`   - ${r.service}/${r.test}: ${r.details}`);
    });
  }
  
  // Known issues (warnings)
  const warnings = results.filter(r => r.status === 'WARN');
  if (warnings.length > 0) {
    console.log('\n📝 KNOWN ISSUES / WARNINGS:');
    warnings.forEach(r => {
      console.log(`   - ${r.service}/${r.test}: ${r.details}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
}

/**
 * Check if all tests passed
 */
export function allTestsPassed(): boolean {
  return results.every(r => r.status === 'PASS' || r.status === 'WARN' || r.status === 'SKIP');
}

/**
 * Get actionable items for AI
 */
export function getActionableItems(): TestResult[] {
  return results.filter(r => r.status === 'FAIL' && r.action);
}
