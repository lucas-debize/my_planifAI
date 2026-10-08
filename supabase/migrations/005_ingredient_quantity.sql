-- Migration 005 : Ajout de la colonne optionnelle de quantité sur les ingrédients d'un plat
alter table public.meal_ingredients
  add column if not exists quantity text;
