import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  Opportunity,
  OpportunityType,
  StudentOpportunity,
  StudentOpportunityStatus,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

export interface ListOpportunitiesFilter {
  query?: string;
  opportunityType?: OpportunityType;
  locationCountryCode?: string;
  isRemote?: boolean;
  providerName?: string;
  page?: number;
  pageSize?: number;
}

function toOpportunity(
  row: Database["public"]["Tables"]["opportunities"]["Row"],
): Opportunity {
  return {
    id: row.id,
    title: row.title,
    providerName: row.provider_name,
    opportunityType: row.opportunity_type as OpportunityType,
    locationCountryCode: row.location_country_code,
    isRemote: row.is_remote,
    durationMonths: row.duration_months,
    description: row.description,
    url: row.url,
    createdAt: new Date(row.created_at),
  };
}

function toStudentOpportunity(
  row: Database["public"]["Tables"]["student_opportunities"]["Row"],
): StudentOpportunity {
  return {
    id: row.id,
    studentId: row.student_id,
    opportunityId: row.opportunity_id,
    status: row.status as StudentOpportunityStatus,
    appliedAt: row.applied_at ? new Date(row.applied_at) : null,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Public catalogue — readable by anon/authenticated (RLS `opportunities_read_all`).
 * Writes are service_role only; the repository goes through the service client
 * when mutating. Reads use the caller's client so RLS is still honoured.
 */
export class OpportunityRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Opportunity | null> {
    const { data, error } = await this.db
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toOpportunity(data);
  }

  async list(filter: ListOpportunitiesFilter = {}): Promise<{ opportunities: Opportunity[]; total: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.db
      .from("opportunities")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filter.opportunityType) {
      query = query.eq("opportunity_type", filter.opportunityType);
    }
    if (filter.locationCountryCode) {
      query = query.eq("location_country_code", filter.locationCountryCode);
    }
    if (filter.isRemote !== undefined) {
      query = query.eq("is_remote", filter.isRemote);
    }
    if (filter.providerName) {
      query = query.ilike("provider_name", `%${filter.providerName}%`);
    }
    if (filter.query) {
      // Use trigram-optimized ILIKE on title; provider already filtered.
      // For simplicity, search title + description via ilike.
      const term = `%${filter.query}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return {
      opportunities: (data ?? []).map(toOpportunity),
      total: count ?? 0,
    };
  }

  async listAll(limit = 100): Promise<Opportunity[]> {
    const { data, error } = await this.db
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toOpportunity);
  }

  async listByType(type: OpportunityType, limit = 50): Promise<Opportunity[]> {
    const { data, error } = await this.db
      .from("opportunities")
      .select("*")
      .eq("opportunity_type", type)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toOpportunity);
  }

  async create(opportunity: Opportunity): Promise<Opportunity> {
    const { data, error } = await this.db
      .from("opportunities")
      .insert({
        id: opportunity.id,
        title: opportunity.title,
        provider_name: opportunity.providerName,
        opportunity_type: opportunity.opportunityType,
        location_country_code: opportunity.locationCountryCode,
        is_remote: opportunity.isRemote,
        duration_months: opportunity.durationMonths,
        description: opportunity.description,
        url: opportunity.url,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toOpportunity(data);
  }

  async listForGapTypes(
    types: OpportunityType[],
    limitPerType = 5,
  ): Promise<Opportunity[]> {
    if (types.length === 0) return [];
    // Fetch per-type and merge, preserving relevance order (input order).
    const results: Opportunity[] = [];
    for (const type of types) {
      const { data, error } = await this.db
        .from("opportunities")
        .select("*")
        .eq("opportunity_type", type)
        .order("created_at", { ascending: false })
        .limit(limitPerType);
      if (error) throw error;
      results.push(...(data ?? []).map(toOpportunity));
    }
    return results;
  }
}

/**
 * Private join — owner-scoped RLS (student_opportunities_*_own).
 * The browser client may select/insert/update/delete its own rows;
 * the service role bypasses RLS for admin ops.
 */
export class StudentOpportunityRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<StudentOpportunity | null> {
    const { data, error } = await this.db
      .from("student_opportunities")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toStudentOpportunity(data);
  }

  async findByStudentAndOpportunity(
    studentId: string,
    opportunityId: string,
  ): Promise<StudentOpportunity | null> {
    const { data, error } = await this.db
      .from("student_opportunities")
      .select("*")
      .eq("student_id", studentId)
      .eq("opportunity_id", opportunityId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toStudentOpportunity(data);
  }

  async listByStudent(
    studentId: string,
    status?: StudentOpportunityStatus,
  ): Promise<StudentOpportunity[]> {
    let query = this.db
      .from("student_opportunities")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toStudentOpportunity);
  }

  async listByStudentWithOpportunities(
    studentId: string,
    status?: StudentOpportunityStatus,
  ): Promise<Array<{ link: StudentOpportunity; opportunity: Opportunity }>> {
    // Two-step fetch to keep types simple and avoid Supabase join typing issues.
    const links = await this.listByStudent(studentId, status);
    if (links.length === 0) return [];
    const ids = links.map((l) => l.opportunityId);
    const { data: opps, error } = await this.db
      .from("opportunities")
      .select("*")
      .in("id", ids);
    if (error) throw error;
    const oppMap = new Map(
      (opps ?? []).map((row) => [row.id, toOpportunity(row)]),
    );
    return links
      .map((link) => {
        const opp = oppMap.get(link.opportunityId);
        if (!opp) return null;
        return { link, opportunity: opp };
      })
      .filter((v): v is { link: StudentOpportunity; opportunity: Opportunity } => v !== null);
  }

  async save(
    input: { studentId: string; opportunityId: string; status?: StudentOpportunityStatus },
  ): Promise<StudentOpportunity> {
    const status = input.status ?? "saved";
    const appliedAt =
      status === "saved" ? null : new Date().toISOString();
    const { data, error } = await this.db
      .from("student_opportunities")
      .insert({
        student_id: input.studentId,
        opportunity_id: input.opportunityId,
        status,
        applied_at: appliedAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toStudentOpportunity(data);
  }

  async updateStatus(
    id: string,
    status: StudentOpportunityStatus,
  ): Promise<StudentOpportunity> {
    const appliedAt = status === "saved" ? null : new Date().toISOString();
    const { data, error } = await this.db
      .from("student_opportunities")
      .update({ status, applied_at: appliedAt })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toStudentOpportunity(data);
  }

  async remove(studentId: string, opportunityId: string): Promise<void> {
    const { error } = await this.db
      .from("student_opportunities")
      .delete()
      .eq("student_id", studentId)
      .eq("opportunity_id", opportunityId);
    if (error) throw error;
  }

  async isSaved(studentId: string, opportunityId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("student_opportunities")
      .select("id")
      .eq("student_id", studentId)
      .eq("opportunity_id", opportunityId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }
}
