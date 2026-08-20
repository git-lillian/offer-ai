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
    id: string;
    user_id: string | null;
    full_name: string;
    email: string | null;
    account_status: string;
    created_by_user_id: string | null;
    claimed_at: string | null;
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
    country_code: string | null;
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
    gpa_scale_max: number | null;
    completed_year: number | null;
    created_at: string;
  }>;

  qualification_systems: Table<{
    code: string;
    name: string;
    description: string | null;
    country_codes: string[];
    grading_scale: string | null;
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
    slug: string;
    name: string;
    parent_subject_id: string | null;
  }>;

  catalog_institutions: Table<{
    id: string;
    name: string;
    slug: string;
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
    slug: string;
    level: string;
    duration_months: number | null;
    tuition_fee: number | null;
    currency_code: string | null;
    application_routes: string[];
    international_applicants_supported: boolean | null;
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
    tuition_fee: number | null;
    fee_currency_code: string | null;
    fee_source_id: string | null;
    fee_observed_at: string | null;
    application_deadline_source_id: string | null;
    application_deadline_observed_at: string | null;
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
    verification_status: string;
  }>;

  catalog_sources: Table<{
    id: string;
    name: string;
    url: string;
    source_owner: string | null;
    extractor_version: string | null;
    fetch_policy: string | null;
    enabled: boolean;
    last_verified_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  catalog_entity_identifiers: Table<{
    id: string;
    entity_type: string;
    entity_id: string;
    identifier_type: string;
    identifier_value: string;
    created_at: string;
  }>;

  catalog_source_snapshots: Table<{
    id: string;
    source_id: string;
    fetched_at: string;
    content_hash: string;
    raw_content: string;
    status: string;
  }>;

  catalog_source_courses: Table<{
    source_id: string;
    course_id: string;
    created_at: string;
  }>;

  catalog_ingestion_runs: Table<{
    id: string;
    source_id: string;
    snapshot_id: string | null;
    status: string;
    content_hash: string | null;
    extracted_count: number;
    published_count: number;
    error: string | null;
    started_at: string;
    completed_at: string | null;
    created_at: string;
  }>;

  student_saved_courses: Table<{
    id: string;
    student_id: string;
    course_id: string;
    created_at: string;
  }>;

  recommendation_runs: Table<{
    id: string;
    student_id: string;
    course_id: string;
    eligibility: string;
    strategy_band: string;
    score: number;
    confidence: number;
    reasons: Json;
    blockers: Json;
    missing_information: Json;
    profile_version: string;
    catalogue_version: string;
    rule_version: string;
    created_at: string;
  }>;

  opportunities: Table<{
    id: string;
    title: string;
    provider_name: string;
    opportunity_type: string;
    location_country_code: string | null;
    is_remote: boolean;
    duration_months: number | null;
    description: string;
    url: string | null;
    created_at: string;
  }>;

  student_opportunities: Table<{
    id: string;
    student_id: string;
    opportunity_id: string;
    status: string;
    applied_at: string | null;
    created_at: string;
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

  application_milestones: Table<{
    id: string;
    case_id: string;
    title: string;
    due_at: string | null;
    status: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
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

  artifact_comments: Table<{
    id: string;
    artifact_id: string;
    version_number: number;
    author_user_id: string;
    body: string;
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

  provider_profiles: Table<{
    id: string;
    user_id: string;
    display_name: string;
    bio: string;
    verification_status: string;
    specialisms: string[];
    country_scope: string[];
    language_scope: string[];
    created_at: string;
    updated_at: string;
  }>;

  service_listings: Table<{
    id: string;
    provider_id: string;
    title: string;
    description: string;
    service_type: string;
    price: number;
    currency_code: string;
    turnaround_days: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;

  bookings: Table<{
    id: string;
    student_id: string;
    service_listing_id: string;
    provider_id: string;
    status: string;
    scheduled_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  service_orders: Table<{
    id: string;
    booking_id: string;
    student_id: string;
    provider_id: string;
    amount: number;
    platform_fee: number;
    total: number;
    currency_code: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;

  service_reviews: Table<{
    id: string;
    order_id: string;
    student_id: string;
    provider_id: string;
    rating: number;
    comment: string;
    created_at: string;
  }>;

  marketplace_commissions: Table<{
    id: string;
    order_id: string;
    provider_id: string;
    amount: number;
    rate: number;
    currency_code: string;
    created_at: string;
  }>;

  billing_customers: Table<{
    id: string;
    user_id: string;
    stripe_customer_id: string | null;
    created_at: string;
  }>;

  billing_subscriptions: Table<{
    id: string;
    customer_id: string;
    stripe_subscription_id: string | null;
    plan_code: string;
    status: string;
    current_period_end: string | null;
    created_at: string;
  }>;

  billing_entitlements: Table<{
    id: string;
    customer_id: string;
    feature_code: string;
    granted_at: string;
    expires_at: string | null;
  }>;

  billing_invoices: Table<{
    id: string;
    customer_id: string;
    stripe_invoice_id: string | null;
    amount_due: number;
    currency_code: string;
    status: string;
    created_at: string;
  }>;

  billing_webhook_events: Table<{
    id: string;
    stripe_event_id: string;
    type: string;
    payload: Json;
    processed: boolean;
    created_at: string;
  }>;

  notifications: Table<{
    id: string;
    user_id: string;
    channel: string;
    notification_type: string;
    title: string;
    body: string;
    payload: Json;
    status: string;
    scheduled_at: string;
    sent_at: string | null;
    created_at: string;
  }>;

  notification_preferences: Table<{
    user_id: string;
    email_enabled: boolean;
    push_enabled: boolean;
    deadline_reminder_days: number[];
    created_at: string;
  }>;

  deadline_watches: Table<{
    id: string;
    student_id: string;
    course_intake_id: string;
    watch_type: string;
    next_reminder_at: string | null;
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
      create_application_case: {
        Args: {
          p_student_id: string;
          p_institution_id: string;
          p_course_id: string;
          p_course_intake_id: string;
          p_application_cycle_id: string;
          p_application_route: string;
          p_actor_user_id: string;
        };
        Returns: Record<string, unknown>;
      };
      transition_application_case: {
        Args: {
          p_case_id: string;
          p_to_status: string;
          p_actor_user_id: string;
          p_event_type: string;
          p_message: string;
          p_metadata: Record<string, unknown> | null;
        };
        Returns: Record<string, unknown>;
      };
      append_application_event: {
        Args: {
          p_case_id: string;
          p_event_type: string;
          p_status: string;
          p_actor_user_id: string;
          p_message: string;
          p_metadata: Record<string, unknown> | null;
        };
        Returns: Record<string, unknown>;
      };
      claim_student_profile: {
        Args: {
          p_student_id: string;
        };
        Returns: Record<string, unknown>;
      };
      create_prospect: {
        Args: {
          p_full_name: string;
          p_email: string | null;
        };
        Returns: Record<string, unknown>;
      };
      catalog_search_courses: {
        Args: {
          p_query?: string | null;
          p_institution_slug?: string | null;
          p_subject_slug?: string | null;
          p_level?: string | null;
          p_city?: string | null;
          p_intake_year?: number | null;
          p_tuition_min?: number | null;
          p_tuition_max?: number | null;
          p_tuition_currency?: string | null;
          p_international?: boolean | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: Record<string, unknown>;
      };
      catalog_search_institutions: {
        Args: {
          p_query?: string | null;
          p_country_code?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: Record<string, unknown>;
      };
      is_provider_owner: {
        Args: {
          p_provider_id: string;
        };
        Returns: boolean;
      };
      is_billing_owner: {
        Args: {
          p_customer_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};
