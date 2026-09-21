-- ============================================================
-- 002_families.sql  –  Groupes familiaux (planning partagé)
-- ============================================================

-- Tables -------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  invite_code text unique not null
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Un utilisateur ne peut être que dans un seul groupe
create unique index family_members_user_unique on public.family_members (user_id);

-- Fonction partagée -------------------------------------------
-- Retourne le owner_id du groupe si l'utilisateur est membre,
-- sinon retourne auth.uid().  SECURITY DEFINER pour lire
-- family_members sans dépendre de la RLS circulaire.

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

-- RLS : familles ----------------------------------------------

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
-- L'admin peut s'ajouter à son propre groupe. Rejoindre un groupe
-- se fait uniquement via public.join_family() (invite_code).
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

revoke all on function public.my_family_id() from public;
revoke all on function public.is_family_owner(uuid) from public;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;

-- Création / adhésion atomiques (bypass RLS, vérifient l'invite)

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

revoke all on function public.create_family(text, text) from public;
revoke all on function public.join_family(text, text) from public;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.effective_owner_id() to authenticated;

-- 003_fix_family_rls.sql ajoute get_my_family / leave_family / delete_family
-- et durcit les helpers (plpgsql + row_security off). Les rejouer ici
-- pour qu'un projet neuf n'ait pas besoin de 003.

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

revoke all on function public.get_my_family() from public;
revoke all on function public.leave_family() from public;
revoke all on function public.delete_family() from public;
grant execute on function public.get_my_family() to authenticated;
grant execute on function public.leave_family() to authenticated;
grant execute on function public.delete_family() to authenticated;

-- RLS : tables existantes → effective_owner_id() --------------

-- meals
drop policy if exists meals_select on public.meals;
drop policy if exists meals_insert on public.meals;
drop policy if exists meals_update on public.meals;
drop policy if exists meals_delete on public.meals;

create policy meals_select on public.meals
  for select using (user_id = public.effective_owner_id());
create policy meals_insert on public.meals
  for insert with check (user_id = public.effective_owner_id());
create policy meals_update on public.meals
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy meals_delete on public.meals
  for delete using (user_id = public.effective_owner_id());

-- ingredients
drop policy if exists ingredients_select on public.ingredients;
drop policy if exists ingredients_insert on public.ingredients;
drop policy if exists ingredients_update on public.ingredients;
drop policy if exists ingredients_delete on public.ingredients;

create policy ingredients_select on public.ingredients
  for select using (user_id = public.effective_owner_id());
create policy ingredients_insert on public.ingredients
  for insert with check (user_id = public.effective_owner_id());
create policy ingredients_update on public.ingredients
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy ingredients_delete on public.ingredients
  for delete using (user_id = public.effective_owner_id());

-- plan_slots
drop policy if exists plan_slots_select on public.plan_slots;
drop policy if exists plan_slots_insert on public.plan_slots;
drop policy if exists plan_slots_update on public.plan_slots;
drop policy if exists plan_slots_delete on public.plan_slots;

create policy plan_slots_select on public.plan_slots
  for select using (user_id = public.effective_owner_id());
create policy plan_slots_insert on public.plan_slots
  for insert with check (user_id = public.effective_owner_id());
create policy plan_slots_update on public.plan_slots
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy plan_slots_delete on public.plan_slots
  for delete using (user_id = public.effective_owner_id());

-- shopping_checks
drop policy if exists shopping_checks_select on public.shopping_checks;
drop policy if exists shopping_checks_insert on public.shopping_checks;
drop policy if exists shopping_checks_update on public.shopping_checks;
drop policy if exists shopping_checks_delete on public.shopping_checks;

create policy shopping_checks_select on public.shopping_checks
  for select using (user_id = public.effective_owner_id());
create policy shopping_checks_insert on public.shopping_checks
  for insert with check (user_id = public.effective_owner_id());
create policy shopping_checks_update on public.shopping_checks
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy shopping_checks_delete on public.shopping_checks
  for delete using (user_id = public.effective_owner_id());

-- meal_ingredients
drop policy if exists meal_ingredients_select on public.meal_ingredients;
drop policy if exists meal_ingredients_insert on public.meal_ingredients;
drop policy if exists meal_ingredients_delete on public.meal_ingredients;

create policy meal_ingredients_select on public.meal_ingredients
  for select using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = public.effective_owner_id()
    )
  );
create policy meal_ingredients_insert on public.meal_ingredients
  for insert with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = public.effective_owner_id()
    )
  );
create policy meal_ingredients_delete on public.meal_ingredients
  for delete using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = public.effective_owner_id()
    )
  );
