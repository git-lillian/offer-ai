import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  StudentProfile,
  StudentEducation,
  StudentQualification,
  StudentExperience,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

function toProfile(row: Database["public"]["Tables"]["student_profiles"]["Row"]): StudentProfile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    accountStatus: row.account_status as StudentProfile["accountStatus"],
    createdByUserId: row.created_by_user_id,
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
    currentCountryCode: row.current_country_code,
    nationalityCountryCode: row.nationality_country_code,
    currentEducationLevel: row.current_education_level,
    intendedStudyLevel: row.intended_study_level as StudentProfile["intendedStudyLevel"],
    targetSubjectAreas: row.target_subject_areas ?? [],
    targetEntryYear: row.target_entry_year,
    targetCountryCodes: row.target_country_codes ?? [],
    budgetRange:
      row.budget_min !== null && row.budget_max !== null
        ? {
            currencyCode: row.budget_currency_code ?? "GBP",
            min: row.budget_min,
            max: row.budget_max,
          }
        : null,
    englishProficiencyStatus:
      row.english_proficiency_status as StudentProfile["englishProficiencyStatus"],
    onboardingCompletedAt: row.onboarding_completed_at ? new Date(row.onboarding_completed_at) : null,
    updatedAt: new Date(row.updated_at),
  };
}

export class StudentProfileRepository {
  constructor(private readonly db: Db) {}

  /** Lookup by the canonical student profile id. */
  async findById(id: string): Promise<StudentProfile | null> {
    const { data } = await this.db
      .from("student_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) return null;
    return toProfile(data);
  }

  /** Lookup by the linked auth account id (null when unclaimed). */
  async findByUserId(userId: string): Promise<StudentProfile | null> {
    const { data } = await this.db
      .from("student_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return null;
    return toProfile(data);
  }

  async createOrUpdate(profile: StudentProfile): Promise<StudentProfile> {
    const row = {
      id: profile.id,
      user_id: profile.userId,
      full_name: profile.fullName,
      email: profile.email,
      account_status: profile.accountStatus,
      created_by_user_id: profile.createdByUserId,
      claimed_at: profile.claimedAt?.toISOString() ?? null,
      current_country_code: profile.currentCountryCode,
      nationality_country_code: profile.nationalityCountryCode,
      current_education_level: profile.currentEducationLevel,
      intended_study_level: profile.intendedStudyLevel,
      target_subject_areas: profile.targetSubjectAreas,
      target_entry_year: profile.targetEntryYear,
      target_country_codes: profile.targetCountryCodes,
      budget_min: profile.budgetRange?.min ?? null,
      budget_max: profile.budgetRange?.max ?? null,
      budget_currency_code: profile.budgetRange?.currencyCode ?? null,
      english_proficiency_status: profile.englishProficiencyStatus,
      onboarding_completed_at: profile.onboardingCompletedAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.db
      .from("student_profiles")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    return toProfile(data);
  }

  /** Links an unclaimed student profile to the current auth account (atomic RPC). */
  async claim(profileId: string): Promise<StudentProfile | null> {
    const { data, error } = await this.db.rpc("claim_student_profile", {
      p_student_id: profileId,
    });
    if (error) throw error;
    return data ? toProfile(data as Database["public"]["Tables"]["student_profiles"]["Row"]) : null;
  }

  /** Creates an unclaimed prospect (adviser/guardian only; role-checked RPC). */
  async createProspect(fullName: string, email: string | null): Promise<StudentProfile | null> {
    const { data, error } = await this.db.rpc("create_prospect", {
      p_full_name: fullName,
      p_email: email,
    });
    if (error) throw error;
    return data ? toProfile(data as Database["public"]["Tables"]["student_profiles"]["Row"]) : null;
  }

  async addEducation(education: StudentEducation): Promise<StudentEducation> {
    const { data, error } = await this.db
      .from("student_education")
      .insert({
        student_id: education.studentId,
        institution_name: education.institutionName,
        country_code: education.countryCode,
        started_year: education.startedYear,
        ended_year: education.endedYear,
        degree_title: education.degreeTitle,
      })
      .select("*")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      studentId: data.student_id,
      institutionName: data.institution_name,
      countryCode: data.country_code,
      startedYear: data.started_year,
      endedYear: data.ended_year,
      degreeTitle: data.degree_title,
    };
  }

  async addQualification(q: StudentQualification): Promise<StudentQualification> {
    const { data, error } = await this.db
      .from("student_qualifications")
      .insert({
        student_id: q.studentId,
        qualification_system: q.qualificationSystem,
        title: q.title,
        institution_name: q.institutionName,
        country_code: q.countryCode,
        grade: q.grade,
        predicted_grade: q.predictedGrade,
        overall_gpa: q.overallGpa,
        gpa_scale_max: q.gpaScaleMax,
        completed_year: q.completedYear,
      })
      .select("*")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      studentId: data.student_id,
      qualificationSystem: data.qualification_system,
      title: data.title,
      institutionName: data.institution_name,
      countryCode: data.country_code,
      grade: data.grade,
      predictedGrade: data.predicted_grade,
      overallGpa: data.overall_gpa,
      gpaScaleMax: data.gpa_scale_max,
      completedYear: data.completed_year,
    };
  }

  async addExperience(e: StudentExperience): Promise<StudentExperience> {
    const { data, error } = await this.db
      .from("student_experiences")
      .insert({
        student_id: e.studentId,
        experience_type: e.experienceType,
        title: e.title,
        organisation_name: e.organisationName,
        started_at: e.startedAt?.toISOString() ?? null,
        ended_at: e.endedAt?.toISOString() ?? null,
        description: e.description,
      })
      .select("*")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      studentId: data.student_id,
      experienceType: data.experience_type as StudentExperience["experienceType"],
      title: data.title,
      organisationName: data.organisation_name,
      startedAt: data.started_at ? new Date(data.started_at) : null,
      endedAt: data.ended_at ? new Date(data.ended_at) : null,
      description: data.description,
    };
  }

  async listEducation(studentId: string): Promise<StudentEducation[]> {
    const { data } = await this.db
      .from("student_education")
      .select("*")
      .eq("student_id", studentId);
    return (data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      institutionName: row.institution_name,
      countryCode: row.country_code,
      startedYear: row.started_year,
      endedYear: row.ended_year,
      degreeTitle: row.degree_title,
    }));
  }

  async listQualifications(studentId: string): Promise<StudentQualification[]> {
    const { data } = await this.db
      .from("student_qualifications")
      .select("*")
      .eq("student_id", studentId);
    return (data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      qualificationSystem: row.qualification_system,
      title: row.title,
      institutionName: row.institution_name,
      countryCode: row.country_code,
      grade: row.grade,
      predictedGrade: row.predicted_grade,
      overallGpa: row.overall_gpa,
      gpaScaleMax: row.gpa_scale_max,
      completedYear: row.completed_year,
    }));
  }

  async listExperiences(studentId: string): Promise<StudentExperience[]> {
    const { data } = await this.db
      .from("student_experiences")
      .select("*")
      .eq("student_id", studentId);
    return (data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      experienceType: row.experience_type as StudentExperience["experienceType"],
      title: row.title,
      organisationName: row.organisation_name,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      description: row.description,
    }));
  }
}
