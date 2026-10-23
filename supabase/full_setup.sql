-- ==============================================================================
-- MyPlanifAI - Setup complet de la base de données Supabase
-- Exécuter ce script en une seule fois dans le SQL Editor de Supabase
-- ==============================================================================

-- 1. Tables de base
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  origin text not null default 'user' check (origin in ('user', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_normalized text not null,
  unique (user_id, name_normalized)
);

create table if not exists public.meal_ingredients (
  meal_id uuid not null references public.meals (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  position int not null default 0,
  primary key (meal_id, ingredient_id)
);

create table if not exists public.plan_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_date date not null,
  slot_kind text not null check (slot_kind in ('dejeuner', 'diner')),
  meal_id uuid references public.meals (id) on delete set null,
  unique (user_id, slot_date, slot_kind)
);

create table if not exists public.shopping_checks (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  checked boolean not null default false,
  primary key (user_id, week_start, ingredient_id)
);

-- Index de performance
create index if not exists meals_user_name on public.meals (user_id, name);
create index if not exists meals_user_origin on public.meals (user_id, origin);
create index if not exists plan_slots_user_date on public.plan_slots (user_id, slot_date);
create index if not exists ingredients_user_norm on public.ingredients (user_id, name_normalized);

-- Fonctions & Triggers utilitaires
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meals_set_updated_at on public.meals;
create trigger meals_set_updated_at
before update on public.meals
for each row
execute function public.set_updated_at();

create or replace function public.normalize_ingredient_name(name text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(name, '\s+', ' ', 'g')));
$$;

create or replace function public.ingredients_normalize()
returns trigger
language plpgsql
as $$
begin
  new.name_normalized := public.normalize_ingredient_name(new.name);
  return new;
end;
$$;

drop trigger if exists ingredients_normalize_biu on public.ingredients;
create trigger ingredients_normalize_biu
before insert or update on public.ingredients
for each row
execute function public.ingredients_normalize();

-- 2. Tables de groupes / familles
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  invite_code text unique not null
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create unique index if not exists family_members_user_unique on public.family_members (user_id);

-- 3. Fonctions RLS sans récursion (SECURITY DEFINER + row_security off)
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

-- 4. Fonctions RPC pour gestion des familles
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

-- Permissions d'exécution
revoke all on function public.my_family_id() from public;
revoke all on function public.is_family_owner(uuid) from public;
revoke all on function public.create_family(text, text) from public;
revoke all on function public.join_family(text, text) from public;
revoke all on function public.get_my_family() from public;
revoke all on function public.leave_family() from public;
revoke all on function public.delete_family() from public;

grant execute on function public.my_family_id() to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;
grant execute on function public.effective_owner_id() to authenticated;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.get_my_family() to authenticated;
grant execute on function public.leave_family() to authenticated;
grant execute on function public.delete_family() to authenticated;

-- 5. Activation RLS & Politiques de sécurité
alter table public.meals enable row level security;
alter table public.ingredients enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.plan_slots enable row level security;
alter table public.shopping_checks enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;

-- Nettoyage idempotent des politiques
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('meals', 'ingredients', 'meal_ingredients', 'plan_slots', 'shopping_checks', 'families', 'family_members')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end
$$;

-- Politiques families & members
create policy families_select on public.families
  for select using (owner_id = auth.uid() or id = public.my_family_id());
create policy families_insert on public.families
  for insert with check (owner_id = auth.uid());
create policy families_update on public.families
  for update using (owner_id = auth.uid());
create policy families_delete on public.families
  for delete using (owner_id = auth.uid());

create policy family_members_select on public.family_members
  for select using (user_id = auth.uid() or family_id = public.my_family_id());
create policy family_members_insert on public.family_members
  for insert with check (user_id = auth.uid() and public.is_family_owner(family_id));
create policy family_members_delete on public.family_members
  for delete using (user_id = auth.uid() or public.is_family_owner(family_id));

grant select, insert, update, delete on public.families to authenticated;
grant select, insert, delete on public.family_members to authenticated;

-- Politiques tables métier basées sur effective_owner_id()
create policy meals_select on public.meals
  for select using (user_id = public.effective_owner_id());
create policy meals_insert on public.meals
  for insert with check (user_id = public.effective_owner_id());
create policy meals_update on public.meals
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy meals_delete on public.meals
  for delete using (user_id = public.effective_owner_id());

create policy ingredients_select on public.ingredients
  for select using (user_id = public.effective_owner_id());
create policy ingredients_insert on public.ingredients
  for insert with check (user_id = public.effective_owner_id());
create policy ingredients_update on public.ingredients
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy ingredients_delete on public.ingredients
  for delete using (user_id = public.effective_owner_id());

create policy plan_slots_select on public.plan_slots
  for select using (user_id = public.effective_owner_id());
create policy plan_slots_insert on public.plan_slots
  for insert with check (user_id = public.effective_owner_id());
create policy plan_slots_update on public.plan_slots
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy plan_slots_delete on public.plan_slots
  for delete using (user_id = public.effective_owner_id());

create policy shopping_checks_select on public.shopping_checks
  for select using (user_id = public.effective_owner_id());
create policy shopping_checks_insert on public.shopping_checks
  for insert with check (user_id = public.effective_owner_id());
create policy shopping_checks_update on public.shopping_checks
  for update using (user_id = public.effective_owner_id())
  with check (user_id = public.effective_owner_id());
create policy shopping_checks_delete on public.shopping_checks
  for delete using (user_id = public.effective_owner_id());

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

-- ==============================================================================
-- 9. Séparation stricte planning personnel / planning familial (004)
-- ==============================================================================

-- Plafonnement à 10 membres dans join_family
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

-- Helper is_family_member
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

-- Colonnes family_id et created_by_user_id
alter table public.meals
  add column if not exists family_id uuid references public.families(id) on delete cascade default null,
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null default null;

create index if not exists meals_family_id_idx on public.meals (family_id) where family_id is not null;

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

-- Politiques RLS unifiées
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
