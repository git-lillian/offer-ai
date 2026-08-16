-- 0003_evidence_documents.sql
-- Evidence items and documents.

-- Documents: metadata for files in private storage buckets.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  file_type text not null,
  mime_type text not null,
  original_filename text not null,
  storage_path text not null unique,
  checksum text not null default '',
  size_bytes integer not null default 0 check (size_bytes >= 0),
  upload_source text not null default 'student',
  processing_status text not null default 'pending' check (processing_status in (
    'pending', 'processing', 'completed', 'failed'
  )),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_student_idx
  on public.documents (student_id);
create index if not exists documents_owner_idx
  on public.documents (owner_user_id);

-- Evidence: every important student claim links to evidence with
-- provenance. AI-extracted facts enter as machine_extracted, never as
-- human_verified.
create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'transcript', 'qualification_certificate', 'language_test_certificate',
    'user_confirmation', 'adviser_confirmation', 'existing_cv', 'reference',
    'portfolio', 'employment_letter', 'other'
  )),
  source_type text not null check (source_type in (
    'uploaded_document', 'user_input', 'ai_extraction', 'adviser_input', 'external_system'
  )),
  source_document_id uuid references public.documents (id) on delete set null,
  description text not null default '',
  verification_status text not null default 'unverified' check (verification_status in (
    'unverified', 'machine_extracted', 'machine_validated', 'human_verified',
    'superseded', 'rejected'
  )),
  verified_by_user_id uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evidence_items_student_idx
  on public.evidence_items (student_id);

