/**
 * Shared contract for key-feature smoke modules.
 * @module tests/smoke/key-features/features/_contract
 */

export type FeatureStatus = "pass" | "fail" | "skip";

export interface FeatureResult {
  feature: string;
  status: FeatureStatus;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type FeatureProbe = () => Promise<FeatureResult>;

export function pass(
  feature: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): FeatureResult {
  return { feature, status: "pass", code, message, details };
}

export function fail(
  feature: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): FeatureResult {
  return { feature, status: "fail", code, message, details };
}

export function skip(
  feature: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): FeatureResult {
  return { feature, status: "skip", code, message, details };
}

export async function runFeature(
  feature: string,
  fn: () => Promise<FeatureResult>,
): Promise<FeatureResult> {
  try {
    const result = await fn();
    return { ...result, feature };
  } catch (error) {
    return fail(
      feature,
      "PROBE_THREW",
      error instanceof Error ? error.message : String(error),
    );
  }
}
