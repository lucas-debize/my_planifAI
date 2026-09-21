-- ============================================================
-- 003_fix_family_rls.sql
-- Corrige : infinite recursion detected in policy for relation
-- "family_members".
--
-- Cause : la politique SELECT relisait family_members, et les
-- fonctions SQL SECURITY DEFINER pouvaient être inlinées par
-- Postgres (la RLS du caller s'appliquait quand même).
--
-- Idempotent : rejouable sur un projet qui a déjà 002.
-- ============================================================

-- Helpers : plpgsql (jamais inliné) + row_security off.

create or replace function public.effective_owner_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  owner uuid;
begin
  select f.owner_id
    into owner
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.user_id = auth.uid()
  limit 1;

  return coalesce(owner, auth.uid());
end;
$$;

create or replace function public.my_family_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  fid uuid;
begin
  select fm.family_id
    into fid
  from public.family_members fm
  where fm.user_id = auth.uid()
  limit 1;

  return fid;
end;
$$;

create or replace function public.is_family_owner(fid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.families f
    where f.id = fid
      and f.owner_id = auth.uid()
  );
end;
$$;

-- Supprime TOUTES les politiques (noms potentiellement différents).

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('families', 'family_members')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      pol.policyname,
      pol.tablename
    );
  end loop;
end
$$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;

create policy families_select on public.families
  for select using (
    owner_id = auth.uid()
    or id = public.my_family_id()
  );
create policy families_insert on public.families
  for insert with check (owner_id = auth.uid());
create policy families_update on public.families
  for update using (owner_id = auth.uid());
create policy families_delete on public.families
  for delete using (owner_id = auth.uid());

create policy family_members_select on public.family_members
  for select using (
    user_id = auth.uid()
    or family_id = public.my_family_id()
  );
create policy family_members_insert on public.family_members
  for insert with check (
    user_id = auth.uid()
    and public.is_family_owner(family_id)
  );
create policy family_members_delete on public.family_members
  for delete using (
    user_id = auth.uid()
    or public.is_family_owner(family_id)
  );

grant select, insert, update, delete on public.families to authenticated;
grant select, insert, delete on public.family_members to authenticated;

-- Création / lecture / adhésion : bypass RLS, pas de récursion.

create or replace function public.create_family(family_name text, member_name text default '')
returns public.families
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  fam public.families;
  v_name text;
  v_display text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_name := trim(family_name);
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'Choisis un nom pour le groupe';
  end if;

  v_display := trim(member_name);
  if v_display = '' then
    v_display := 'Membre';
  end if;

  if exists (
    select 1 from public.family_members fm where fm.user_id = auth.uid()
  ) then
    raise exception 'Tu fais déjà partie d''un groupe';
  end if;

  delete from public.families f
  where f.owner_id = auth.uid()
    and not exists (
      select 1 from public.family_members fm where fm.family_id = f.id
    );

  insert into public.families (name, owner_id)
  values (v_name, auth.uid())
  returning * into fam;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (fam.id, auth.uid(), 'admin', v_display);

  return fam;
end;
$$;

create or replace function public.join_family(invite text, member_name text default '')
returns public.families
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  fam public.families;
  v_code text;
  v_display text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_code := lower(trim(invite));
  v_display := trim(member_name);
  if v_display = '' then
    v_display := 'Membre';
  end if;

  if v_code = '' then
    raise exception 'Code d''invitation invalide';
  end if;

  if exists (
    select 1 from public.family_members fm where fm.user_id = auth.uid()
  ) then
    raise exception 'Tu fais déjà partie d''un groupe';
  end if;

  select * into fam
  from public.families
  where invite_code = v_code;

  if not found then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (fam.id, auth.uid(), 'member', v_display);

  return fam;
end;
$$;

create or replace function public.get_my_family()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select jsonb_build_object(
    'family', to_jsonb(f.*),
    'members', coalesce((
      select jsonb_agg(to_jsonb(fm.*) order by fm.joined_at)
      from public.family_members fm
      where fm.family_id = f.id
    ), '[]'::jsonb)
  )
  into result
  from public.families f
  join public.family_members me
    on me.family_id = f.id
  where me.user_id = auth.uid()
  limit 1;

  return result;
end;
$$;

create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select fm.role into v_role
  from public.family_members fm
  where fm.user_id = auth.uid();

  if not found then
    raise exception 'Tu n''es dans aucun groupe';
  end if;

  if v_role = 'admin' then
    raise exception 'L''admin ne peut pas quitter : supprime le groupe';
  end if;

  delete from public.family_members
  where user_id = auth.uid();
end;
$$;

create or replace function public.delete_family()
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  delete from public.families
  where owner_id = auth.uid();

  if not found then
    raise exception 'Seul l''admin peut supprimer le groupe';
  end if;
end;
$$;

revoke all on function public.effective_owner_id() from public;
revoke all on function public.my_family_id() from public;
revoke all on function public.is_family_owner(uuid) from public;
revoke all on function public.create_family(text, text) from public;
revoke all on function public.join_family(text, text) from public;
revoke all on function public.get_my_family() from public;
revoke all on function public.leave_family() from public;
revoke all on function public.delete_family() from public;

grant execute on function public.effective_owner_id() to authenticated;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.get_my_family() to authenticated;
grant execute on function public.leave_family() to authenticated;
grant execute on function public.delete_family() to authenticated;

notify pgrst, 'reload schema';
