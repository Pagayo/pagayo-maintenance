/**
 * Type definitions for ci-failure-catalog (used by vitest).
 */

export type FailureClassification =
  | "ai-behavioral"
  | "deterministic"
  | "infra"
  | "flake";

export type PreventionLayer =
  | "preflight"
  | "ci-doctor"
  | "playbook-trigger"
  | "workflow"
  | "none";

export type EntryStatus = "active" | "proposed" | "archived";
export type EntryConfidence = "high" | "medium" | "low";

export interface CatalogMatch {
  patterns: string[];
}

export interface CatalogPrevention {
  layer: PreventionLayer;
  ref: string;
}

export interface CatalogFix {
  playbook?: string;
  summary: string;
}

export interface CatalogEntry {
  id: string;
  title: string;
  classification: FailureClassification;
  repos?: string[];
  workflows?: string[];
  jobs?: string[];
  match: CatalogMatch;
  prevention: CatalogPrevention;
  fix: CatalogFix;
  status: EntryStatus;
  confidence: EntryConfidence;
}

export interface Catalog {
  version: 1;
  entries: CatalogEntry[];
}

export interface StatsCluster {
  fingerprint: string;
  count: number;
  workflowName?: string;
  jobName?: string;
  catalogId?: string | null;
  repo?: string;
}

export interface StatsDocument {
  version: number;
  generatedAt: string | null;
  source: string;
  windowDays: number;
  repos: Record<string, { failures: number; matched: number }>;
  clusters: StatsCluster[];
  alerts: string[];
}
