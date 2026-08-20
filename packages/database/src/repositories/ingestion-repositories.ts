import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type { Source, SourceSnapshot } from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

/**
 * Postgres-backed source registry.
 * RLS: catalog_sources is readable by anon/authenticated; writes are service-only.
 * This repository goes through the service client.
 */
export class SourceRegistryRepository {
  constructor(private readonly db: Db) {}

  async listEnabledSources(): Promise<Source[]> {
    const { data, error } = await this.db.from("catalog_sources").select("*").eq("enabled", true).order("name");
    if (error) throw error;
    return (data ?? []).map(toSource);
  }

  async getById(sourceId: string): Promise<Source | null> {
    const { data } = await this.db.from("catalog_sources").select("*").eq("id", sourceId).maybeSingle();
    if (!data) return null;
    return toSource(data);
  }

  async recordFetch(sourceId: string, fetchedAt: Date): Promise<void> {
    const { error } = await this.db
      .from("catalog_sources")
      .update({ last_verified_at: fetchedAt.toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", sourceId);
    if (error) throw error;
  }

  async listAll(limit = 100): Promise<Source[]> {
    const { data, error } = await this.db.from("catalog_sources").select("*").order("created_at").limit(limit);
    if (error) throw error;
    return (data ?? []).map(toSource);
  }
}

export class SourceSnapshotRepository {
  constructor(private readonly db: Db) {}

  async getLatest(sourceId: string): Promise<SourceSnapshot | null> {
    const { data } = await this.db
      .from("catalog_source_snapshots")
      .select("*")
      .eq("source_id", sourceId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return toSnapshot(data);
  }

  async listForSource(sourceId: string, limit = 20): Promise<SourceSnapshot[]> {
    const { data, error } = await this.db
      .from("catalog_source_snapshots")
      .select("*")
      .eq("source_id", sourceId)
      .order("fetched_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toSnapshot);
  }

  async countForSource(sourceId: string): Promise<number> {
    const { count, error } = await this.db
      .from("catalog_source_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId);
    if (error) throw error;
    return count ?? 0;
  }
}

function toSource(row: Database["public"]["Tables"]["catalog_sources"]["Row"]): Source {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    sourceOwner: row.source_owner,
    extractorVersion: row.extractor_version,
    fetchPolicy: row.fetch_policy,
    enabled: row.enabled,
    lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toSnapshot(row: Database["public"]["Tables"]["catalog_source_snapshots"]["Row"]): SourceSnapshot {
  return {
    id: row.id,
    sourceId: row.source_id,
    fetchedAt: new Date(row.fetched_at),
    contentHash: row.content_hash,
    rawContent: row.raw_content,
    status: row.status,
  };
}
