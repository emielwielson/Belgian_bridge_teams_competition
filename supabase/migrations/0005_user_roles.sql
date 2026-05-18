-- Task 2.2: Role assignments (FR 60–61)

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role),
  constraint user_roles_role_check check (
    role in (
      'player',
      'captain',
      'club_manager',
      'arbiter',
      'competition_manager',
      'system_admin'
    )
  )
);

create index user_roles_user_id_idx on public.user_roles (user_id);

alter table public.user_roles enable row level security;
