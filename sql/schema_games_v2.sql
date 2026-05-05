-- Run this after schema_games.sql
alter table user_games add column if not exists phase text
  check (phase in ('opening','early_middlegame','middlegame','late_middlegame','endgame'));
alter table user_games add column if not exists notes text;
alter table user_games add column if not exists opponent_rating integer;
