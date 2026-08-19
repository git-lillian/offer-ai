import type { Source, SourceSnapshot } from "@offer-ai/domain";
import { ExternalServiceError } from "@offer-ai/domain";
import { hashContent } from "./hashing";
import type { ContentFetcher, RawSnapshot } from "./pipeline";

export interface FetcherOptions {
  /** Request timeout in ms, default 15000. */
  timeoutMs?: number;
  /** User agent for politeness. */
  userAgent?: string;
}

export class HttpContentFetcher implements ContentFetcher {
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(options: FetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.userAgent = options.userAgent ?? "Offer.ai-Ingestion/1.0 (+https://offer-ai.local/bot)";
  }

  async fetch(source: Source): Promise<RawSnapshot | null> {
    if (!source.enabled) {
      return null;
    }

    // Respect fetch_policy if present: value like "monthly", "weekly" is
    // informational — scheduling is handled elsewhere. Here we only enforce
    // that disabled sources never fetch. Real politeness (robots.txt, rate
    // limiting) is enforced at the schedule layer; this fetcher only does
    // HTTP fetch + hash.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(source.url, {
        method: "GET",
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExternalServiceError(`Fetch timed out for source ${source.id} (${source.url})`);
      }
      throw new ExternalServiceError(`Fetch failed for source ${source.id}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new ExternalServiceError(`Fetch failed for source ${source.id}: HTTP ${response.status} ${response.statusText}`, {
        sourceId: source.id,
        url: source.url,
        status: response.status,
      });
    }

    const rawContent = await response.text();
    const contentHash = hashContent(rawContent);

    // Caller (IngestionPipeline) decides whether hash is unchanged — fetcher
    // always returns the raw snapshot; null is reserved for disabled sources.
    // Deduplication at snapshot layer avoids re-extraction of identical content.
    return {
      sourceId: source.id,
      fetchedAt: new Date(),
      contentHash,
      rawContent,
    };
  }
}

/**
 * Test helper — deterministic fetcher that returns a fixed snapshot without
 * performing network I/O. For unit tests and local development without source
 * network access.
 */
export class FakeContentFetcher implements ContentFetcher {
  private readonly contentBySourceId: Map<string, string>;

  constructor(contentBySourceId: Record<string, string>) {
    this.contentBySourceId = new Map(Object.entries(contentBySourceId));
  }

  async fetch(source: Source): Promise<RawSnapshot | null> {
    if (!source.enabled) return null;
    const rawContent = this.contentBySourceId.get(source.id) ?? this.contentBySourceId.get(source.url) ?? `<html><body>Fake content for ${source.name}</body></html>`;
    const contentHash = hashContent(rawContent);
    return {
      sourceId: source.id,
      fetchedAt: new Date(),
      contentHash,
      rawContent,
    };
  }
}

/**
 * Compare a fetched hash against the latest stored snapshot hash to decide
 * whether re-extraction is needed. Pure function for testability.
 */
export function isUnchangedContent(fetchedHash: string, latestSnapshot: SourceSnapshot | null): boolean {
  if (!latestSnapshot) return false;
  return fetchedHash === latestSnapshot.contentHash;
}
