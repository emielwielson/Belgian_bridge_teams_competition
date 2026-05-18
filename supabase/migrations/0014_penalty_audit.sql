-- Penalty audit columns for admin corrections (FR 41, 57–58)

alter table public.penalties
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz;
