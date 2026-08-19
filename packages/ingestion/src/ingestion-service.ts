import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@offer-ai/database";
import type { Source, SourceSnapshot } from "@offer-ai/domain";
import type { IngestionPipeline } from "./pipeline";
import { HttpContentFetcher } from "./fetcher";
import { HeuristicExtractor } from "./extractor";
import { IngestionNormalizer } from "./normalizer";
import { CataloguePublisherService } from "./publisher";

type Db = SupabaseClient<Database>;

export interface IngestionServiceOptions {
  db: Db;
  fetcher?: HttpContentFetcher;
}

/**
 * Orchestrates source → fetch → snapshot → extract → normalize → publish.
 *
 * Durability: snapshots are immutable, content hash dedupes, publish is
 * diff-based and idempotent. The same source can be re-run safely.
 */
export class IngestionService implements IngestionPipeline {
  private readonly db: Db;
  private readonly fetcher: HttpContentFetcher;
  private readonly extractor: HeuristicExtractor;
  private readonly normalizer: IngestionNormalizer;
  private readonly publisher: CataloguePublisherService;

  constructor(options: IngestionServiceOptions) {
    this.db = options.db;
    this.fetcher = options.fetcher ?? new HttpContentFetcher();
    this.extractor = new HeuristicExtractor();
    this.normalizer = new IngestionNormalizer();
    this.publisher = new CataloguePublisherService(this.db);
  }

  async run(sourceId: string): Promise<{ processed: number; published: number; skipped: number }> {
    const source = await this.getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    if (!source.enabled) return { processed: 0, published: 0, skipped: 0 };

    const fetched = await this.fetcher.fetch(source);
    if (!fetched) return { processed: 0, published: 0, skipped: 0 };

    // Deduplicate: if latest stored snapshot has same hash, skip extraction.
    const latest = await this.getLatestSnapshot(sourceId);
    if (latest && latest.contentHash === fetched.contentHash) {
      await this.markSourceFetched(sourceId);
      return { processed: 0, published: 0, skipped: 1 };
    }

    const snapshotRow = await this.storeSnapshot(fetched);
    const domainSnapshot: SourceSnapshot = {
      id: snapshotRow.id,
      sourceId: snapshotRow.source_id,
      fetchedAt: new Date(snapshotRow.fetched_at),
      contentHash: snapshotRow.content_hash,
      rawContent: snapshotRow.raw_content,
      status: snapshotRow.status,
    };

    const facts = await this.extractor.extract(domainSnapshot);
    if (facts.length === 0) {
      await this.markSnapshotExtracted(snapshotRow.id);
      await this.markSourceFetched(sourceId);
      return { processed: 0, published: 0, skipped: 0 };
    }

    const records = await this.normalizer.normalize(facts);
    if (records.length === 0) {
      await this.markSnapshotExtracted(snapshotRow.id);
      await this.markSourceFetched(sourceId);
      return { processed: facts.length, published: 0, skipped: 0 };
    }

    await this.publisher.publish(records);
    await this.markSnapshotExtracted(snapshotRow.id);
    await this.markSourceFetched(sourceId);

    return { processed: facts.length, published: records.length, skipped: 0 };
  }

  private async getSource(sourceId: string): Promise<Source | null> {
    const { data } = await this.db.from("catalog_sources").select("*").eq("id", sourceId).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      url: data.url,
      sourceOwner: data.source_owner,
      extractorVersion: data.extractor_version,
      fetchPolicy: data.fetch_policy,
      enabled: data.enabled,
      lastVerifiedAt: data.last_verified_at ? new Date(data.last_verified_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private async getLatestSnapshot(sourceId: string): Promise<SourceSnapshot | null> {
    const { data } = await this.db
      .from("catalog_source_snapshots")
      .select("*")
      .eq("source_id", sourceId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      sourceId: data.source_id,
      fetchedAt: new Date(data.fetched_at),
      contentHash: data.content_hash,
      rawContent: data.raw_content,
      status: data.status,
    };
  }

  private async storeSnapshot(fetched: { sourceId: string; fetchedAt: Date; contentHash: string; rawContent: string }) {
    // Use the fetched hash directly (already canonical SHA-256 of rawContent)
    const { data, error } = await this.db
      .from("catalog_source_snapshots")
      .insert({
        source_id: fetched.sourceId,
        fetched_at: fetched.fetchedAt.toISOString(),
        content_hash: fetched.contentHash,
        raw_content: fetched.rawContent,
        status: "stored",
      } as never)
      .select("*")
      .single();
    if (error || !data) throw new Error(`Failed to store snapshot: ${error?.message ?? "no data"}`);
    return data as { id: string; source_id: string; fetched_at: string; content_hash: string; raw_content: string; status: string };
  }

  private async markSnapshotExtracted(snapshotId: string): Promise<void> {
    await this.db.from("catalog_source_snapshots").update({ status: "extracted" } as never).eq("id", snapshotId);
  }

  private async markSourceFetched(sourceId: string): Promise<void> {
    await this.db.from("catalog_sources").update({ last_verified_at: new Date().toISOString() } as never).eq("id", sourceId);
  }
}
