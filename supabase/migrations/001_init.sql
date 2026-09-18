create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  origin text not null default 'user' check (origin in ('user', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_normalized text not null,
  unique (user_id, name_normalized)
);

create table public.meal_ingredients (
  meal_id uuid not null references public.meals (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  position int not null default 0,
  primary key (meal_id, ingredient_id)
);

create table public.plan_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_date date not null,
  slot_kind text not null check (slot_kind in ('dejeuner', 'diner')),
  meal_id uuid references public.meals (id) on delete set null,
  unique (user_id, slot_date, slot_kind)
);

create table public.shopping_checks (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  checked boolean not null default false,
  primary key (user_id, week_start, ingredient_id)
);

create index meals_user_name on public.meals (user_id, name);
create index meals_user_origin on public.meals (user_id, origin);
create index plan_slots_user_date on public.plan_slots (user_id, slot_date);
create index ingredients_user_norm on public.ingredients (user_id, name_normalized);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create trigger ingredients_normalize_biu
before insert or update on public.ingredients
for each row
execute function public.ingredients_normalize();

alter table public.meals enable row level security;
alter table public.ingredients enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.plan_slots enable row level security;
alter table public.shopping_checks enable row level security;

create policy meals_select on public.meals
  for select using (auth.uid() = user_id);
create policy meals_insert on public.meals
  for insert with check (auth.uid() = user_id);
create policy meals_update on public.meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy meals_delete on public.meals
  for delete using (auth.uid() = user_id);

create policy ingredients_select on public.ingredients
  for select using (auth.uid() = user_id);
create policy ingredients_insert on public.ingredients
  for insert with check (auth.uid() = user_id);
create policy ingredients_update on public.ingredients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ingredients_delete on public.ingredients
  for delete using (auth.uid() = user_id);

create policy plan_slots_select on public.plan_slots
  for select using (auth.uid() = user_id);
create policy plan_slots_insert on public.plan_slots
  for insert with check (auth.uid() = user_id);
create policy plan_slots_update on public.plan_slots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy plan_slots_delete on public.plan_slots
  for delete using (auth.uid() = user_id);

create policy shopping_checks_select on public.shopping_checks
  for select using (auth.uid() = user_id);
create policy shopping_checks_insert on public.shopping_checks
  for insert with check (auth.uid() = user_id);
create policy shopping_checks_update on public.shopping_checks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy shopping_checks_delete on public.shopping_checks
  for delete using (auth.uid() = user_id);

create policy meal_ingredients_select on public.meal_ingredients
  for select using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = auth.uid()
    )
  );

create policy meal_ingredients_insert on public.meal_ingredients
  for insert with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = auth.uid()
    )
  );

create policy meal_ingredients_delete on public.meal_ingredients
  for delete using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = auth.uid()
    )
  );
