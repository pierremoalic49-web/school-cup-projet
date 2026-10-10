-- =====================================================================
-- School Cup : base de données Supabase
-- À copier-coller en entier dans Supabase > SQL Editor > New query > Run.
-- Règle de sécurité : tout le monde peut LIRE, seuls les admins peuvent ÉCRIRE.
-- =====================================================================

-- 1. Les tables -------------------------------------------------------

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),         -- une seule ligne de réglages
  name text not null default 'School Cup',
  school text not null default 'Lycée Sacré-Cœur La Salle',
  city text not null default 'Angers',
  dates text not null default 'Dates à confirmer',
  place text not null default 'Lieu à confirmer',
  schedule text not null default '',
  rules text not null default '',
  contact text not null default '',
  half_length int not null default 10 check (half_length between 3 and 45),
  demo boolean not null default false
);

create table if not exists public.teams (
  id uuid primary key,
  tournament_id text not null check (tournament_id in ('g', 'f')),   -- g = garçons, f = filles
  name text not null,
  short text not null check (char_length(short) between 1 and 3),
  classe text not null default '',
  color1 text not null default '#FFC63D',
  color2 text not null default '#1A1200',
  captain_id uuid
);

create table if not exists public.players (
  id uuid primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  first_name text not null,
  last_initial text not null check (char_length(last_initial) = 1),  -- RGPD : initiale seulement
  position text not null check (position in ('GB', 'DEF', 'MIL', 'ATT')),
  rating int not null default 75 check (rating between 50 and 99),
  number int check (number between 1 and 99),            -- numéro de maillot
  photo_url text,
  consent boolean not null default false,
  -- Droit à l'image : impossible d'avoir une photo sans autorisation, même par erreur.
  constraint photo_needs_consent check (consent or photo_url is null)
);

create table if not exists public.matches (
  id uuid primary key,
  tournament_id text not null check (tournament_id in ('g', 'f')),
  round int not null,
  "order" int not null,
  team_a_id uuid references public.teams (id) on delete set null,
  team_b_id uuid references public.teams (id) on delete set null,
  score_a int not null default 0 check (score_a >= 0),
  score_b int not null default 0 check (score_b >= 0),
  pen_a int,
  pen_b int,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'halftime', 'finished')),
  kickoff text,
  period int not null default 1 check (period in (1, 2)),
  period_started_at timestamptz,
  field text not null default 'Terrain 1',
  next_match_id uuid references public.matches (id) on delete set null,
  next_slot text check (next_slot in ('A', 'B'))
);

create table if not exists public.goals (
  id uuid primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid references public.players (id) on delete set null,
  team_id uuid not null references public.teams (id) on delete cascade,
  minute int not null check (minute between 0 and 200),
  created_at timestamptz not null default now()
);

-- La liste des comptes organisateurs autorisés à modifier.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Base déjà créée avec une version plus ancienne de ce script : on ajoute les colonnes manquantes.
alter table public.players add column if not exists number int check (number between 1 and 99);

create index if not exists players_team_idx on public.players (team_id);
create index if not exists matches_tournament_idx on public.matches (tournament_id);
create index if not exists goals_match_idx on public.goals (match_id);
create index if not exists goals_player_idx on public.goals (player_id);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 2. « Suis-je admin ? » ---------------------------------------------
-- Fonction ordinaire (security invoker) : elle lit la table admins avec les droits de la
-- personne connectée, qui n'a le droit de voir que sa propre ligne.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- 2 bis. Le score se met à jour tout seul quand un but est ajouté ou annulé.
-- C'est la base qui fait +1 / -1 : si deux organisateurs valident un but en même temps, aucun n'est perdu.
create or replace function public.goal_updates_score()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.matches
       set score_a = score_a + (case when new.team_id = team_a_id then 1 else 0 end),
           score_b = score_b + (case when new.team_id = team_b_id then 1 else 0 end)
     where id = new.match_id;
    return new;
  else
    update public.matches
       set score_a = greatest(0, score_a - (case when old.team_id = team_a_id then 1 else 0 end)),
           score_b = greatest(0, score_b - (case when old.team_id = team_b_id then 1 else 0 end))
     where id = old.match_id;
    return old;
  end if;
end;
$$;

drop trigger if exists goal_updates_score on public.goals;
create trigger goal_updates_score
  after insert or delete on public.goals
  for each row execute function public.goal_updates_score();

-- 3. Sécurité ligne par ligne (RLS) -----------------------------------

alter table public.settings enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.goals enable row level security;
alter table public.admins enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings', 'teams', 'players', 'matches', 'goals'] loop
    execute format('drop policy if exists "lecture publique" on public.%I', t);
    execute format('create policy "lecture publique" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "ajout admin" on public.%I', t);
    execute format('create policy "ajout admin" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('drop policy if exists "modif admin" on public.%I', t);
    execute format('create policy "modif admin" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('drop policy if exists "suppression admin" on public.%I', t);
    execute format('create policy "suppression admin" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

drop policy if exists "voir sa ligne" on public.admins;
create policy "voir sa ligne" on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- 4. Accès par l'API (obligatoire depuis 2026 : les tables ne sont plus exposées d'office) --

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.teams, public.players, public.matches, public.goals to anon;
grant select, insert, update, delete on public.settings, public.teams, public.players, public.matches, public.goals to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- 5. Temps réel : le site est prévenu à chaque changement ---------------

do $$
declare t text;
begin
  foreach t in array array['settings', 'teams', 'players', 'matches', 'goals'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 6. Photos des joueurs ------------------------------------------------
-- Dossier « photos » lisible par tous (les URLs ne sont enregistrées qu'avec l'autorisation),
-- et seuls les admins peuvent envoyer, remplacer ou supprimer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "photos : admin lit" on storage.objects;
create policy "photos : admin lit" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));
drop policy if exists "photos : admin envoie" on storage.objects;
create policy "photos : admin envoie" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select public.is_admin()));
drop policy if exists "photos : admin remplace" on storage.objects;
create policy "photos : admin remplace" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()))
  with check (bucket_id = 'photos' and (select public.is_admin()));
drop policy if exists "photos : admin supprime" on storage.objects;
create policy "photos : admin supprime" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));

-- =====================================================================
-- 7. DERNIÈRE ÉTAPE (à faire après avoir créé les comptes organisateurs) :
-- remplace l'email ci-dessous, puis exécute uniquement ces lignes.
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'prenom.nom@exemple.fr';
-- =====================================================================
