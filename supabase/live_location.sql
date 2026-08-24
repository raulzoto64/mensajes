-- Posición "en vivo" de cada usuario: se actualiza seguido para ver el
-- movimiento en tiempo real. NO es historial (una sola fila por usuario).
create table if not exists user_live (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  lat      double precision,
  lng      double precision,
  accuracy double precision,
  at       timestamptz default now()
);

alter table user_live enable row level security;

drop policy if exists "Live readable by authenticated" on user_live;
create policy "Live readable by authenticated"
  on user_live for select
  using (auth.uid() is not null);

drop policy if exists "Live insert own" on user_live;
create policy "Live insert own"
  on user_live for insert
  with check (auth.uid() = user_id);

drop policy if exists "Live update own" on user_live;
create policy "Live update own"
  on user_live for update
  using (auth.uid() = user_id);

-- Marca la ubicación de registro en el historial de direcciones guardadas.
alter table user_locations add column if not exists is_registration boolean default false;
