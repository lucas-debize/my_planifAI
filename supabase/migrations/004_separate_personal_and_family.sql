-- ============================================================
-- 004_separate_personal_and_family.sql
-- Différenciation stricte planning personnel / planning familial (max 10 membres)
-- ============================================================

-- 1. Plafonnement à 10 membres dans join_family ----------------
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
  v_count int;
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

  -- Limite à 10 membres par groupe
  select count(*) into v_count
  from public.family_members
  where family_id = fam.id;

  if v_count >= 10 then
    raise exception 'Ce groupe a atteint la limite maximale de 10 personnes';
  end if;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (fam.id, auth.uid(), 'member', v_display);

  return fam;
end;
$$;

revoke all on function public.join_family(text, text) from public;
grant execute on function public.join_family(text, text) to authenticated;

-- 2. Fonction utilitaire RLS is_family_member -------------------
create or replace function public.is_family_member(fid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if fid is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.family_members fm
    where fm.family_id = fid and fm.user_id = auth.uid()
  );
end;
$$;

revoke all on function public.is_family_member(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;

-- 3. Colonnes family_id et created_by_user_id -------------------

-- Table meals
alter table public.meals
  add column if not exists family_id uuid references public.families(id) on delete cascade default null,
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null default null;

create index if not exists meals_family_id_idx on public.meals (family_id) where family_id is not null;

-- Table ingredients
alter table public.ingredients
  add column if not exists family_id uuid references public.families(id) on delete cascade default null;

alter table public.ingredients drop constraint if exists ingredients_user_id_name_normalized_key;
drop index if exists public.ingredients_user_norm;
drop index if exists public.ingredients_user_norm_idx;
drop index if exists public.ingredients_family_norm_idx;

create unique index if not exists ingredients_user_norm_idx
  on public.ingredients (user_id, name_normalized)
  where family_id is null;

create unique index if not exists ingredients_family_norm_idx
  on public.ingredients (family_id, name_normalized)
  where family_id is not null;

-- Table plan_slots
alter table public.plan_slots
  add column if not exists family_id uuid references public.families(id) on delete cascade default null;

alter table public.plan_slots drop constraint if exists plan_slots_user_id_slot_date_slot_kind_key;
drop index if exists public.plan_slots_user_date;
drop index if exists public.plan_slots_user_date_kind_idx;
drop index if exists public.plan_slots_family_date_kind_idx;

create unique index if not exists plan_slots_user_date_kind_idx
  on public.plan_slots (user_id, slot_date, slot_kind)
  where family_id is null;

create unique index if not exists plan_slots_family_date_kind_idx
  on public.plan_slots (family_id, slot_date, slot_kind)
  where family_id is not null;

create index if not exists plan_slots_family_date_idx
  on public.plan_slots (family_id, slot_date)
  where family_id is not null;

-- Table shopping_checks
alter table public.shopping_checks
  add column if not exists family_id uuid references public.families(id) on delete cascade default null;

alter table public.shopping_checks drop constraint if exists shopping_checks_pkey;
alter table public.shopping_checks add column if not exists id uuid default gen_random_uuid() primary key;

drop index if exists public.shopping_checks_user_idx;
drop index if exists public.shopping_checks_family_idx;

create unique index if not exists shopping_checks_user_idx
  on public.shopping_checks (user_id, week_start, ingredient_id)
  where family_id is null;

create unique index if not exists shopping_checks_family_idx
  on public.shopping_checks (family_id, week_start, ingredient_id)
  where family_id is not null;

-- 4. Politiques RLS unifiées ------------------------------------

-- Drop existing policies
drop policy if exists meals_select on public.meals;
drop policy if exists meals_insert on public.meals;
drop policy if exists meals_update on public.meals;
drop policy if exists meals_delete on public.meals;

create policy meals_select on public.meals
  for select using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy meals_insert on public.meals
  for insert with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy meals_update on public.meals
  for update using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  )
  with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy meals_delete on public.meals
  for delete using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

-- Ingredients policies
drop policy if exists ingredients_select on public.ingredients;
drop policy if exists ingredients_insert on public.ingredients;
drop policy if exists ingredients_update on public.ingredients;
drop policy if exists ingredients_delete on public.ingredients;

create policy ingredients_select on public.ingredients
  for select using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy ingredients_insert on public.ingredients
  for insert with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy ingredients_update on public.ingredients
  for update using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  )
  with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy ingredients_delete on public.ingredients
  for delete using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

-- Plan slots policies
drop policy if exists plan_slots_select on public.plan_slots;
drop policy if exists plan_slots_insert on public.plan_slots;
drop policy if exists plan_slots_update on public.plan_slots;
drop policy if exists plan_slots_delete on public.plan_slots;

create policy plan_slots_select on public.plan_slots
  for select using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy plan_slots_insert on public.plan_slots
  for insert with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy plan_slots_update on public.plan_slots
  for update using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  )
  with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy plan_slots_delete on public.plan_slots
  for delete using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

-- Shopping checks policies
drop policy if exists shopping_checks_select on public.shopping_checks;
drop policy if exists shopping_checks_insert on public.shopping_checks;
drop policy if exists shopping_checks_update on public.shopping_checks;
drop policy if exists shopping_checks_delete on public.shopping_checks;

create policy shopping_checks_select on public.shopping_checks
  for select using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy shopping_checks_insert on public.shopping_checks
  for insert with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy shopping_checks_update on public.shopping_checks
  for update using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  )
  with check (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

create policy shopping_checks_delete on public.shopping_checks
  for delete using (
    (family_id is null and user_id = auth.uid()) or
    (family_id is not null and public.is_family_member(family_id))
  );

-- Meal ingredients policies
drop policy if exists meal_ingredients_select on public.meal_ingredients;
drop policy if exists meal_ingredients_insert on public.meal_ingredients;
drop policy if exists meal_ingredients_delete on public.meal_ingredients;

create policy meal_ingredients_select on public.meal_ingredients
  for select using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and (
        (m.family_id is null and m.user_id = auth.uid()) or
        (m.family_id is not null and public.is_family_member(m.family_id))
      )
    )
  );

create policy meal_ingredients_insert on public.meal_ingredients
  for insert with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and (
        (m.family_id is null and m.user_id = auth.uid()) or
        (m.family_id is not null and public.is_family_member(m.family_id))
      )
    )
  );

create policy meal_ingredients_delete on public.meal_ingredients
  for delete using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and (
        (m.family_id is null and m.user_id = auth.uid()) or
        (m.family_id is not null and public.is_family_member(m.family_id))
      )
    )
  );
