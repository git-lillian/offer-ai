/**
 * Ingestion pipeline interfaces.
 *
 * Foundation status: interfaces and types only — no crawler, no scheduler.
 * The conceptual pipeline: source registry → schedule → fetch → raw
 * snapshot → extract → normalize → validate → diff → review → publish.
 */

import type { Source, SourceSnapshot, CourseRequirement } from "@offer-ai/domain";

export interface SourceRegistry {
  listEnabledSources(): Promise<Source[]>;
  recordFetch(sourceId: string, fetchedAt: Date): Promise<void>;
}

export interface RawSnapshot {
  sourceId: string;
  fetchedAt: Date;
  contentHash: string;
  rawContent: string;
}

export interface ContentFetcher {
  fetch(source: Source): Promise<RawSnapshot | null>; // null = unchanged content
}

export interface ExtractedFact {
  sourceId: string;
  contentHash: string;
  extractorVersion: string;
  kind: "institution" | "course" | "requirement";
  structured: Record<string, unknown>;
  sourceText: string;
  confidence: number;
}

export interface Extractor {
  extract(snapshot: SourceSnapshot): Promise<ExtractedFact[]>;
}

export interface NormalizedRecord {
  fact: ExtractedFact;
  canonical: Partial<CourseRequirement>;
}

export interface Normalizer {
  normalize(facts: ExtractedFact[]): Promise<NormalizedRecord[]>;
}

export interface CataloguePublisher {
  publish(records: NormalizedRecord[]): Promise<void>;
}

export interface IngestionPipeline {
  run(sourceId: string): Promise<{ processed: number; published: number; skipped: number }>;
}
