-- Online games imported from Lichess / Chess.com
-- Run this in the Supabase SQL editor

create table if not exists online_games (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- source
  platform            text not null check (platform in ('lichess', 'chess.com')),
  platform_game_id    text not null,
  platform_username   text not null,
  pgn                 text not null,

  -- derived metadata
  name                text,
  opening             text,
  eco                 text,
  result              text check (result in ('win','loss','draw')),
  player_color        text check (player_color in ('white','black')),
  opponent            text,
  opponent_rating     integer,
  time_control        text,
  time_control_category text check (time_control_category in ('bullet','blitz','rapid','classical')),
  game_date           text,
  played_at           timestamptz,

  created_at          timestamptz not null default now(),

  unique (user_id, platform, platform_game_id)
);

-- Indexes for efficient queries and future opening stats
create index if not exists online_games_user_played   on online_games(user_id, played_at desc nulls last);
create index if not exists online_games_user_platform on online_games(user_id, platform);
create index if not exists online_games_user_tc       on online_games(user_id, time_control_category);
create index if not exists online_games_user_result   on online_games(user_id, result);
create index if not exists online_games_user_opening  on online_games(user_id, opening);

-- Row-level security
alter table online_games enable row level security;

create policy "Users can manage own online games"
  on online_games for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
