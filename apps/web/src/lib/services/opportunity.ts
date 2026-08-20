import "server-only";
import {
  OpportunityRepository,
  StudentOpportunityRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { NotFoundError, ConflictError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import type { ListOpportunitiesInput } from "@offer-ai/contracts";
import type { Opportunity, StudentOpportunity } from "@offer-ai/domain";

export class OpportunityApplicationService {
  async list(
    input: ListOpportunitiesInput,
  ): Promise<{ opportunities: Opportunity[]; total: number }> {
    const supabase = await getServerClient();
    const repo = new OpportunityRepository(supabase);
    const result = await repo.list({
      query: input.query,
      opportunityType: input.opportunityType,
      locationCountryCode: input.locationCountryCode,
      isRemote: input.isRemote,
      providerName: input.providerName,
      page: input.page,
      pageSize: input.pageSize,
    });
    return result;
  }

  async getById(id: string): Promise<Opportunity> {
    const supabase = await getServerClient();
    const repo = new OpportunityRepository(supabase);
    const opportunity = await repo.findById(id);
    if (!opportunity) {
      throw new NotFoundError("Opportunity not found.");
    }
    return opportunity;
  }

  async isSavedForUser(userId: string, opportunityId: string): Promise<boolean> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) return false;
    const repo = new StudentOpportunityRepository(supabase);
    return repo.isSaved(profile.id, opportunityId);
  }

  async saveForUser(userId: string, opportunityId: string): Promise<StudentOpportunity> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found. Complete onboarding first.");
    }

    const oppRepo = new OpportunityRepository(supabase);
    const opportunity = await oppRepo.findById(opportunityId);
    if (!opportunity) {
      throw new NotFoundError("Opportunity not found.");
    }

    const repo = new StudentOpportunityRepository(supabase);
    const existing = await repo.findByStudentAndOpportunity(profile.id, opportunityId);
    if (existing) {
      throw new ConflictError("Opportunity already saved.");
    }

    try {
      return await repo.save({ studentId: profile.id, opportunityId, status: "saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("duplicate") || message.includes("unique")) {
        throw new ConflictError("Opportunity already saved.");
      }
      throw error;
    }
  }

  async unsaveForUser(userId: string, opportunityId: string): Promise<void> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found.");
    }
    const repo = new StudentOpportunityRepository(supabase);
    await repo.remove(profile.id, opportunityId);
  }

  async listSavedForUser(userId: string): Promise<StudentOpportunity[]> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) return [];
    const repo = new StudentOpportunityRepository(supabase);
    return repo.listByStudent(profile.id, "saved");
  }

  async listSavedIdsForUser(userId: string): Promise<string[]> {
    const saved = await this.listSavedForUser(userId);
    return saved.map((s) => s.opportunityId);
  }
}

export async function createOpportunityService(): Promise<OpportunityApplicationService> {
  return new OpportunityApplicationService();
}
