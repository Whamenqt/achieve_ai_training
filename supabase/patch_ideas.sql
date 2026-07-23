-- =====================================================================
--  PATCH · run once in Supabase → SQL Editor → New query
--  1) let supervising admins (not just the superadmin) delete ideas
--  2) let a learner withdraw submitted ideas back to editing
--  Safe to re-run.
-- =====================================================================

-- 1) ideas delete policy: learner (own), supervising admin, or superadmin
drop policy if exists ideas_delete on public.ideas;
create policy ideas_delete on public.ideas for delete using (
  learner_id = auth.uid() or public.can_supervise_project(project_id)
);

-- 2) status workflow: add the learner "withdraw" path back to editing
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
    -- allow the normal forward step, exception statuses, OR a learner withdraw
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
