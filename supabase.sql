-- =====================================================================
--  CIN — schema Supabase
--  Incolla tutto questo nel SQL Editor di Supabase ed esegui una volta.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Tabella delle stanze
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  password    text not null,
  status      text not null default 'waiting',   -- waiting | playing | finished
  player1_id  text not null,
  player2_id  text,
  state       jsonb,                              -- stato completo della partita
  version     integer not null default 0,        -- concorrenza ottimistica
  winner      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rooms_password_status_idx
  on public.rooms (password, status);

-- ---------------------------------------------------------------------
--  Sicurezza: lettura libera (serve al Realtime), scrittura solo via RPC
-- ---------------------------------------------------------------------
alter table public.rooms enable row level security;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select using (true);

-- Abilita il Realtime sulla tabella (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  create_room: crea una stanza in attesa
-- ---------------------------------------------------------------------
create or replace function public.create_room(p_password text, p_client_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  insert into public.rooms (password, status, player1_id)
  values (p_password, 'waiting', p_client_id)
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------
--  join_room: entra nella stanza in attesa più vecchia con quella password.
--  Ritorna l'id della stanza, oppure NULL se non esiste.
-- ---------------------------------------------------------------------
create or replace function public.join_room(p_password text, p_client_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare r_id uuid;
begin
  update public.rooms
     set player2_id = p_client_id,
         status = 'playing',
         updated_at = now()
   where id = (
     select id from public.rooms
      where password = p_password
        and status = 'waiting'
        and player1_id <> p_client_id
      order by created_at asc
      limit 1
      for update skip locked
   )
  returning id into r_id;
  return r_id;
end;
$$;

-- ---------------------------------------------------------------------
--  commit_state: applica una mossa in modo atomico.
--  Aggiorna solo se la versione attesa combacia (chi arriva primo vince
--  la gara: è così che si decide chi ha calato/detto "Cin" per primo).
-- ---------------------------------------------------------------------
create or replace function public.commit_state(p_id uuid, p_expected integer, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
  w text;
begin
  w := p_state->>'winner';
  update public.rooms
     set state = p_state,
         version = version + 1,
         winner = w,
         status = case when w is not null and w <> 'null' then 'finished' else status end,
         updated_at = now()
   where id = p_id and version = p_expected;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- ---------------------------------------------------------------------
--  Permessi di esecuzione per il ruolo pubblico (anon)
-- ---------------------------------------------------------------------
grant execute on function public.create_room(text, text)             to anon, authenticated;
grant execute on function public.join_room(text, text)               to anon, authenticated;
grant execute on function public.commit_state(uuid, integer, jsonb)  to anon, authenticated;
