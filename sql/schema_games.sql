create table if not exists user_games (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  name           text not null default 'Untitled',
  pgn            text not null,
  opening        text,
  eco            text,
  result         text check (result in ('win', 'loss', 'draw')),
  player_color   text check (player_color in ('white', 'black')),
  opponent       text,
  time_control   text,
  game_date      text,
  tags           text[] not null default '{}',
  created_at     timestamptz not null default now()
);

alter table user_games enable row level security;

create policy "Users manage their own games"
  on user_games for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_games_user_created
  on user_games (user_id, created_at desc);
