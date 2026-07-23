-- =====================================================================
--  ACHIEVE AI TRAINING DATABASE  ·  Supabase schema
--  Run this ENTIRE file once in: Supabase Dashboard -> SQL Editor -> New query
--  Safe to re-run: policies/functions are dropped and recreated idempotently.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('superadmin','admin','learner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum (
    'not_started','ideas_in_progress','ideas_submitted','ideas_under_review',
    'changes_requested','project_selected','scope_in_progress','scope_submitted',
    'scope_approved','building','testing','project_submitted',
    'final_changes_requested','approved','on_hold','withdrawn','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type scope_status as enum ('draft','submitted','approved','changes_requested');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comment_type as enum ('general','feedback','question','decision');
exception when duplicate_object then null; end $$;

do $$ begin
  create type material_status as enum ('draft','published');
exception when duplicate_object then null; end $$;

-- =====================================================================
--  TABLES
-- =====================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  role          user_role not null default 'learner',
  team          text,
  supervisor_id uuid references public.profiles(id) on delete set null,
  active        boolean not null default true,
  last_login    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.invitations (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  full_name     text,
  role          user_role not null default 'learner',
  team          text,
  supervisor_id uuid references public.profiles(id) on delete set null,
  token         uuid not null default gen_random_uuid(),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles(id) on delete set null
);
create index if not exists idx_invitations_email on public.invitations(lower(email));

create table if not exists public.categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  sort  int not null default 0
);

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  learner_id       uuid not null references public.profiles(id) on delete cascade,
  title            text,
  category         text,
  status           project_status not null default 'not_started',
  selected_idea_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_project_per_learner on public.projects(learner_id);

create table if not exists public.ideas (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  learner_id       uuid not null references public.profiles(id) on delete cascade,
  title            text,
  problem          text,
  people_affected  text,
  current_process  text,
  proposed_solution text,
  expected_benefit text,
  info_required    text,
  risks            text,
  complexity       text,
  success_measure  text,
  category         text,
  is_selected      boolean not null default false,
  submitted        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.scopes (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  project_name       text,
  problem_statement  text,
  intended_users     text,
  current_process    text,
  proposed_solution  text,
  user_journey       text,
  required_inputs    text,
  expected_outputs   text,
  features_v1        text,
  features_excluded  text,
  database_reqs      text,
  storage_reqs       text,
  roles_permissions  text,
  privacy_security   text,
  human_approval     text,
  success_measures   text,
  test_cases         text,
  known_risks        text,
  future_improvements text,
  status             scope_status not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists uq_scope_per_project on public.scopes(project_id);

create table if not exists public.project_updates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  completed   text,
  working_on  text,
  blocker     text,
  help_needed text,
  next_step   text,
  link        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  parent_id    uuid references public.comments(id) on delete cascade,
  body         text not null,
  ctype        comment_type not null default 'general',
  resolved     boolean not null default false,
  attachment_url text,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);

create table if not exists public.attachments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name   text,
  file_url    text,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

create table if not exists public.training_materials (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  file_url    text,
  category    text,
  version     text default 'v1',
  status      material_status not null default 'draft',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.final_submissions (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  title                 text,
  description           text,
  problem_solved        text,
  intended_users        text,
  live_link             text,
  doc_link              text,
  code_link             text,
  screenshots           text,
  features_completed    text,
  features_not_completed text,
  limitations           text,
  test_results          text,
  privacy_notes         text,
  reflection            text,
  future_improvements   text,
  locked                boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists uq_final_per_project on public.final_submissions(project_id);

create table if not exists public.evaluations (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  evaluator_id     uuid references public.profiles(id) on delete set null,
  scores           jsonb not null default '{}'::jsonb,
  overall_feedback text,
  required_changes text,
  decision         text,
  showcase         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_eval_per_project on public.evaluations(project_id);

create table if not exists public.status_history (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  previous_status project_status,
  new_status     project_status not null,
  changed_by     uuid references public.profiles(id) on delete set null,
  reason         text,
  created_at     timestamptz not null default now()
);

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  project_id  uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  ntype      text,
  message    text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =====================================================================
--  HELPER FUNCTIONS  (SECURITY DEFINER -> avoid RLS recursion)
-- =====================================================================
create or replace function public.my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' and active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('superadmin','admin') and active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.supervises(_learner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = _learner and supervisor_id = auth.uid());
$$;

create or replace function public.can_access_project(_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.projects p
    join public.profiles pr on pr.id = p.learner_id
    where p.id = _project and (
      public.is_superadmin() or p.learner_id = auth.uid() or pr.supervisor_id = auth.uid()
    )
  );
$$;

create or replace function public.can_supervise_project(_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.projects p
    join public.profiles pr on pr.id = p.learner_id
    where p.id = _project and ( public.is_superadmin() or pr.supervisor_id = auth.uid() )
  );
$$;

-- =====================================================================
--  NEW USER PROVISIONING
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations
  where lower(email) = lower(new.email) and accepted_at is null
  order by created_at desc limit 1;

  if inv.id is not null then
    insert into public.profiles(id, email, full_name, role, team, supervisor_id, active)
    values (new.id, new.email, coalesce(inv.full_name, new.email), inv.role, inv.team, inv.supervisor_id, true);
    update public.invitations set accepted_at = now(), accepted_by = new.id where id = inv.id;
    if inv.role = 'learner' then
      insert into public.projects(learner_id, status) values (new.id, 'not_started')
      on conflict (learner_id) do nothing;
    end if;
    insert into public.activity_log(actor_id, action, entity_type, entity_id, detail)
    values (new.id, 'user_created', 'profile', new.id, jsonb_build_object('role', inv.role, 'email', new.email));
  else
    insert into public.profiles(id, email, full_name, role, active)
    values (new.id, new.email, new.email, 'learner', false);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================================
--  CONTROLLED STATUS CHANGES
-- =====================================================================
create or replace function public.change_project_status(
  _project uuid, _new project_status, _reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  _cur project_status;
  _role user_role := public.my_role();
  _allowed project_status[];
begin
  if not public.can_access_project(_project) then
    raise exception 'Not authorised for this project';
  end if;
  select status into _cur from public.projects where id = _project;

  _allowed := case _cur
    when 'not_started'             then array['ideas_in_progress']::project_status[]
    when 'ideas_in_progress'       then array['ideas_submitted']::project_status[]
    when 'ideas_submitted'         then array['ideas_under_review','project_selected','changes_requested']::project_status[]
    when 'ideas_under_review'      then array['changes_requested','project_selected']::project_status[]
    when 'changes_requested'       then array['ideas_submitted','scope_in_progress','scope_submitted']::project_status[]
    when 'project_selected'        then array['scope_in_progress']::project_status[]
    when 'scope_in_progress'       then array['scope_submitted']::project_status[]
    when 'scope_submitted'         then array['scope_approved','changes_requested']::project_status[]
    when 'scope_approved'          then array['building']::project_status[]
    when 'building'                then array['testing']::project_status[]
    when 'testing'                 then array['project_submitted','building']::project_status[]
    when 'project_submitted'       then array['final_changes_requested','approved']::project_status[]
    when 'final_changes_requested' then array['project_submitted']::project_status[]
    when 'approved'                then array[]::project_status[]
    else array[]::project_status[]
  end;

  if _role <> 'superadmin' then
    if not ( _new = any(_allowed)
             or _new in ('on_hold','withdrawn')
             or (_new = 'ideas_in_progress' and _cur in ('ideas_submitted','ideas_under_review')) ) then
      raise exception 'Illegal status transition: % -> %', _cur, _new;
    end if;
    if _role = 'learner' and _new in (
      'ideas_under_review','changes_requested','project_selected',
      'scope_approved','final_changes_requested','approved','archived') then
      raise exception 'Learners cannot set status %', _new;
    end if;
  end if;

  update public.projects set status = _new, updated_at = now() where id = _project;
  insert into public.status_history(project_id, previous_status, new_status, changed_by, reason)
  values (_project, _cur, _new, auth.uid(), _reason);
  insert into public.activity_log(actor_id, action, entity_type, entity_id, project_id, detail)
  values (auth.uid(), 'status_changed', 'project', _project, _project,
          jsonb_build_object('from', _cur, 'to', _new, 'reason', _reason));
  insert into public.notifications(user_id, ntype, message, link)
  select learner_id, 'status', 'Project status changed to ' || replace(_new::text,'_',' '), '#/project'
  from public.projects where id = _project and learner_id <> auth.uid();
end $$;

-- =====================================================================
--  AUDIT & NOTIFICATION TRIGGERS
-- =====================================================================
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare _pid uuid;
begin
  begin _pid := coalesce(new.project_id, old.project_id); exception when others then _pid := null; end;
  insert into public.activity_log(actor_id, action, entity_type, entity_id, project_id, detail)
  values (auth.uid(), tg_op || '_' || tg_table_name, tg_table_name, coalesce(new.id, old.id), _pid, null);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_log_ideas on public.ideas;
create trigger trg_log_ideas after insert or update on public.ideas for each row execute function public.log_activity();
drop trigger if exists trg_log_scopes on public.scopes;
create trigger trg_log_scopes after insert or update on public.scopes for each row execute function public.log_activity();
drop trigger if exists trg_log_final on public.final_submissions;
create trigger trg_log_final after insert or update on public.final_submissions for each row execute function public.log_activity();
drop trigger if exists trg_log_eval on public.evaluations;
create trigger trg_log_eval after insert or update on public.evaluations for each row execute function public.log_activity();
drop trigger if exists trg_log_comments on public.comments;
create trigger trg_log_comments after insert on public.comments for each row execute function public.log_activity();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare _learner uuid; _supervisor uuid;
begin
  select p.learner_id, pr.supervisor_id into _learner, _supervisor
  from public.projects p join public.profiles pr on pr.id = p.learner_id where p.id = new.project_id;
  if new.author_id = _learner and _supervisor is not null then
    insert into public.notifications(user_id, ntype, message, link)
    values (_supervisor, 'comment', 'New comment from learner', '#/project/' || new.project_id);
  elsif new.author_id <> _learner then
    insert into public.notifications(user_id, ntype, message, link)
    values (_learner, 'comment', 'New comment on your project', '#/project');
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments for each row execute function public.notify_comment();

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.invitations        enable row level security;
alter table public.categories         enable row level security;
alter table public.projects           enable row level security;
alter table public.ideas              enable row level security;
alter table public.scopes             enable row level security;
alter table public.project_updates    enable row level security;
alter table public.comments           enable row level security;
alter table public.attachments        enable row level security;
alter table public.training_materials enable row level security;
alter table public.final_submissions  enable row level security;
alter table public.evaluations        enable row level security;
alter table public.status_history     enable row level security;
alter table public.activity_log       enable row level security;
alter table public.notifications      enable row level security;
alter table public.settings           enable row level security;
alter table public.announcements      enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  public.is_superadmin() or id = auth.uid() or supervisor_id = auth.uid()
  or (public.my_role() = 'admin' and role = 'admin')
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_superadmin() or id = auth.uid())
  with check (public.is_superadmin() or id = auth.uid());
drop policy if exists profiles_super_delete on public.profiles;
create policy profiles_super_delete on public.profiles for delete using (public.is_superadmin());

drop policy if exists inv_all on public.invitations;
create policy inv_all on public.invitations for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists cat_read on public.categories;
create policy cat_read on public.categories for select using (auth.uid() is not null);
drop policy if exists cat_write on public.categories;
create policy cat_write on public.categories for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists proj_select on public.projects;
create policy proj_select on public.projects for select using (public.can_access_project(id));
drop policy if exists proj_update on public.projects;
create policy proj_update on public.projects for update using (public.can_access_project(id));
drop policy if exists proj_insert on public.projects;
create policy proj_insert on public.projects for insert with check (public.is_superadmin() or learner_id = auth.uid());

drop policy if exists ideas_select on public.ideas;
create policy ideas_select on public.ideas for select using (public.can_access_project(project_id));
drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas for insert with check (learner_id = auth.uid() or public.is_superadmin());
drop policy if exists ideas_update on public.ideas;
create policy ideas_update on public.ideas for update using (learner_id = auth.uid() or public.can_supervise_project(project_id));
drop policy if exists ideas_delete on public.ideas;
create policy ideas_delete on public.ideas for delete using (learner_id = auth.uid() or public.can_supervise_project(project_id));

drop policy if exists scope_select on public.scopes;
create policy scope_select on public.scopes for select using (public.can_access_project(project_id));
drop policy if exists scope_cud on public.scopes;
create policy scope_cud on public.scopes for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

drop policy if exists upd_select on public.project_updates;
create policy upd_select on public.project_updates for select using (public.can_access_project(project_id));
drop policy if exists upd_insert on public.project_updates;
create policy upd_insert on public.project_updates for insert with check (author_id = auth.uid() and public.can_access_project(project_id));

drop policy if exists com_select on public.comments;
create policy com_select on public.comments for select using (public.can_access_project(project_id));
drop policy if exists com_insert on public.comments;
create policy com_insert on public.comments for insert with check (author_id = auth.uid() and public.can_access_project(project_id));
drop policy if exists com_update on public.comments;
create policy com_update on public.comments for update using (author_id = auth.uid() or public.can_supervise_project(project_id));

drop policy if exists att_select on public.attachments;
create policy att_select on public.attachments for select using (public.can_access_project(project_id));
drop policy if exists att_insert on public.attachments;
create policy att_insert on public.attachments for insert with check (public.can_access_project(project_id));
drop policy if exists att_delete on public.attachments;
create policy att_delete on public.attachments for delete using (uploaded_by = auth.uid() or public.is_superadmin());

drop policy if exists tm_select on public.training_materials;
create policy tm_select on public.training_materials for select using (status = 'published' or public.is_staff());
drop policy if exists tm_write on public.training_materials;
create policy tm_write on public.training_materials for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists fin_select on public.final_submissions;
create policy fin_select on public.final_submissions for select using (public.can_access_project(project_id));
drop policy if exists fin_insert on public.final_submissions;
create policy fin_insert on public.final_submissions for insert with check (public.can_access_project(project_id));
drop policy if exists fin_update on public.final_submissions;
create policy fin_update on public.final_submissions for update using (
  public.can_supervise_project(project_id) or (public.can_access_project(project_id) and locked = false)
);

drop policy if exists eval_select on public.evaluations;
create policy eval_select on public.evaluations for select using (public.can_access_project(project_id));
drop policy if exists eval_write on public.evaluations;
create policy eval_write on public.evaluations for all
  using (public.can_supervise_project(project_id)) with check (public.can_supervise_project(project_id));

drop policy if exists sh_select on public.status_history;
create policy sh_select on public.status_history for select using (public.can_access_project(project_id));

drop policy if exists al_select on public.activity_log;
create policy al_select on public.activity_log for select using (
  public.is_superadmin() or actor_id = auth.uid()
  or (project_id is not null and public.can_access_project(project_id))
);

drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select using (user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (user_id = auth.uid());
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert with check (public.is_staff());

drop policy if exists set_read on public.settings;
create policy set_read on public.settings for select using (auth.uid() is not null);
drop policy if exists set_write on public.settings;
create policy set_write on public.settings for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select using (auth.uid() is not null);
drop policy if exists ann_write on public.announcements;
create policy ann_write on public.announcements for all using (public.is_superadmin()) with check (public.is_superadmin());

-- =====================================================================
--  STORAGE BUCKETS + POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public) values ('materials','materials', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('project-files','project-files', true) on conflict (id) do nothing;

drop policy if exists storage_materials_write on storage.objects;
create policy storage_materials_write on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.is_staff());
drop policy if exists storage_materials_update on storage.objects;
create policy storage_materials_update on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.is_staff());
drop policy if exists storage_materials_delete on storage.objects;
create policy storage_materials_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.is_superadmin());

drop policy if exists storage_project_write on storage.objects;
create policy storage_project_write on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files');
drop policy if exists storage_project_delete on storage.objects;
create policy storage_project_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and owner = auth.uid());

-- =====================================================================
--  SEED DATA
-- =====================================================================
insert into public.categories(name, sort) values
  ('Administration',1),('Communication',2),('Data and reporting',3),('Scheduling',4),
  ('Course development',5),('Quality assurance',6),('Customer service',7),('Research',8),
  ('Content creation',9),('Personal productivity',10),('Process automation',11),('Other',12)
on conflict (name) do nothing;

insert into public.settings(key, value) values
  ('deadline_ideas_due',''),('deadline_idea_selection_due',''),('deadline_scope_due',''),
  ('deadline_scope_approval_due',''),('deadline_submission_due',''),('deadline_final_review_due',''),
  ('program_name','Achieve AI Training'),
  ('rubric_criteria','Problem clarity|Practical usefulness|Scope discipline|User experience|Accuracy|Reliability|Privacy and safety|Appropriate human oversight|Testing quality|Documentation|Demonstrated learning')
on conflict (key) do nothing;

-- >>> THE FIRST SUPERADMIN <<<  (change email if needed)
insert into public.invitations(email, full_name, role)
values ('maryke.kennard@gmail.com', 'Maryke', 'superadmin')
on conflict do nothing;
