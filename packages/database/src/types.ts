/**
 * Database row types — hand-written to mirror `supabase/migrations/`.
 *
 * Keep in sync with migrations; used to type the Supabase client so
 * repositories get compile-time safety on table names and columns.
 */

export type Json = Record<string, unknown> | null;

type Row<P extends { [key: string]: unknown }> = { [K in keyof P]: P[K] };

type Table<P extends { [key: string]: unknown }> = {
  Row: Row<P>;
  Insert: Partial<Row<P>>;
  Update: Partial<Row<P>>;
  Relationships: [];
};

export type Tables = {
  student_profiles: Table<{
    user_id: string;
    full_name: string;
    email: string;
    current_country_code: string | null;
    nationality_country_code: string | null;
    current_education_level: string | null;
    intended_study_level: string | null;
    target_subject_areas: string[];
    target_entry_year: number | null;
    target_country_codes: string[];
    budget_min: number | null;
    budget_max: number | null;
    budget_currency_code: string | null;
    english_proficiency_status: string | null;
    onboarding_completed_at: string | null;
    updated_at: string;
    created_at: string;
  }>;

  student_education: Table<{
    id: string;
    student_id: string;
    institution_name: string;
    country_code: string;
    started_year: number;
    ended_year: number | null;
    degree_title: string | null;
    created_at: string;
  }>;

  student_qualifications: Table<{
    id: string;
    student_id: string;
    qualification_system: string;
    title: string;
    institution_name: string | null;
    country_code: string | null;
    grade: string | null;
    predicted_grade: string | null;
    overall_gpa: number | null;
    completed_year: number | null;
    created_at: string;
  }>;

  student_experiences: Table<{
    id: string;
    student_id: string;
    experience_type: string;
    title: string;
    organisation_name: string | null;
    started_at: string | null;
    ended_at: string | null;
    description: string;
    created_at: string;
  }>;

  student_goals: Table<{
    student_id: string;
    study_goals: string;
    career_goals: string;
    updated_at: string;
  }>;

  evidence_items: Table<{
    id: string;
    student_id: string;
    evidence_type: string;
    source_type: string;
    source_document_id: string | null;
    description: string;
    verification_status: string;
    verified_by_user_id: string | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  documents: Table<{
    id: string;
    student_id: string;
    owner_user_id: string;
    file_type: string;
    mime_type: string;
    original_filename: string;
    storage_path: string;
    checksum: string;
    size_bytes: number;
    upload_source: string;
    processing_status: string;
    version: number;
    created_at: string;
    updated_at: string;
  }>;

  identity_roles: Table<{
    code: string;
    name: string;
    description: string | null;
  }>;

  identity_user_roles: Table<{
    user_id: string;
    role_code: string;
    assigned_at: string;
  }>;

  user_preferences: Table<{
    user_id: string;
    locale: string;
    timezone: string;
    currency_code: string;
    updated_at: string;
  }>;

  organisations: Table<{
    id: string;
    name: string;
    type: string;
    country_code: string;
    created_at: string;
    updated_at: string;
  }>;

  organisation_memberships: Table<{
    id: string;
    organisation_id: string;
    user_id: string;
    role_in_organisation: string;
    joined_at: string;
  }>;

  catalog_subjects: Table<{
    id: string;
    code: string;
    name: string;
    parent_subject_id: string | null;
  }>;

  catalog_institutions: Table<{
    id: string;
    name: string;
    country_code: string;
    city: string | null;
    website_url: string | null;
    created_at: string;
    updated_at: string;
  }>;

  catalog_courses: Table<{
    id: string;
    institution_id: string;
    subject_id: string | null;
    title: string;
    level: string;
    duration_months: number | null;
    tuition_fee: number | null;
    currency_code: string | null;
    created_at: string;
    updated_at: string;
  }>;

  catalog_application_cycles: Table<{
    id: string;
    code: string;
    starts_year: number;
    ends_year: number;
    status: string;
  }>;

  catalog_course_intakes: Table<{
    id: string;
    course_id: string;
    application_cycle_id: string;
    intake_month: number;
    intake_year: number;
    application_deadline: string | null;
    closed: boolean;
  }>;

  catalog_course_requirements: Table<{
    id: string;
    course_id: string;
    kind: string;
    structured: Json;
    source_text: string;
    source_id: string | null;
    effective_from: string;
    effective_to: string | null;
    observed_at: string;
    published_at: string;
    superseded_by_id: string | null;
  }>;

  catalog_sources: Table<{
    id: string;
    name: string;
    url: string;
    source_owner: string | null;
    extractor_version: string | null;
    fetch_policy: string | null;
    enabled: boolean;
    created_at: string;
    updated_at: string;
  }>;

  catalog_source_snapshots: Table<{
    id: string;
    source_id: string;
    fetched_at: string;
    content_hash: string;
    raw_content: string;
    status: string;
  }>;

  application_cases: Table<{
    id: string;
    student_id: string;
    institution_id: string;
    course_id: string;
    course_intake_id: string;
    application_cycle_id: string;
    application_route: string;
    current_status: string;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  application_events: Table<{
    id: string;
    case_id: string;
    event_type: string;
    status: string;
    actor_user_id: string | null;
    message: string;
    metadata: Json;
    occurred_at: string;
  }>;

  application_tasks: Table<{
    id: string;
    case_id: string;
    title: string;
    description: string;
    source: string;
    assignee_user_id: string | null;
    due_at: string | null;
    priority: string;
    status: string;
    completion_evidence: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  application_case_documents: Table<{
    case_id: string;
    document_id: string;
    purpose: string;
    added_at: string;
  }>;

  artifacts: Table<{
    id: string;
    student_id: string;
    case_id: string | null;
    artifact_type: string;
    title: string;
    latest_version_id: string | null;
    approval_state: string;
    created_at: string;
    updated_at: string;
  }>;

  artifact_versions: Table<{
    id: string;
    artifact_id: string;
    version_number: number;
    content: string;
    creator_user_id: string;
    origin: string;
    prompt_version: string | null;
    model_run_id: string | null;
    evidence_used: string[];
    approval_state: string;
    created_at: string;
  }>;

  access_grants: Table<{
    id: string;
    student_id: string;
    grantee_user_id: string;
    scope: string;
    scope_id: string | null;
    granted_by_user_id: string;
    granted_at: string;
    expires_at: string | null;
    status: string;
    revoked_by_user_id: string | null;
    revoked_at: string | null;
  }>;

  consents: Table<{
    id: string;
    user_id: string;
    consent_type: string;
    policy_version: string;
    granted_at: string;
    revoked_at: string | null;
    source: string;
  }>;

  audit_logs: Table<{
    id: string;
    actor_user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string;
    correlation_id: string | null;
    metadata: Json;
    created_at: string;
  }>;

  ai_runs: Table<{
    id: string;
    operation: string;
    provider: string;
    model: string;
    prompt_version: string;
    input_hash: string | null;
    student_id: string | null;
    application_case_id: string | null;
    artifact_id: string | null;
    latency_ms: number | null;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number | null;
    status: string;
    error_class: string | null;
    correlation_id: string | null;
    created_at: string;
  }>;

  background_jobs: Table<{
    id: string;
    kind: string;
    payload: Json;
    status: string;
    idempotency_key: string | null;
    correlation_id: string | null;
    attempts: number;
    max_attempts: number;
    last_error: string | null;
    available_at: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
  }>;
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      enqueue_job: {
        Args: {
          p_kind: string;
          p_payload: Record<string, unknown>;
          p_idempotency_key: string | null;
          p_correlation_id: string | null;
          p_max_attempts: number;
        };
        Returns: Tables["background_jobs"]["Row"];
      };
    };
    Enums: Record<string, never>;
  };
};
