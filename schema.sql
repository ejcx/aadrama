create table public.player_stats (

  id text not null,

  session_id text not null,

  name text not null,

  map text not null,

  kills integer not null,

  deaths integer not null,

  player_honor integer not null,

  time timestamp without time zone not null,

  created_at timestamp without time zone not null default now(),

  constraint player_stats_pkey primary key (id)

) TABLESPACE pg_default;

create index IF not exists idx_player_stats_session_name on public.player_stats using btree (session_id, name) TABLESPACE pg_default;

create index IF not exists idx_player_stats_name_time on public.player_stats using btree (name, "time" desc) TABLESPACE pg_default;

create index IF not exists idx_player_stats_lower_name_time on public.player_stats using btree (lower(name), "time" desc) TABLESPACE pg_default;

create index IF not exists idx_player_stats_map_time on public.player_stats using btree (map, "time" desc) TABLESPACE pg_default;

create index IF not exists idx_player_stats_map_name on public.player_stats using btree (map, name) TABLESPACE pg_default;

create index IF not exists idx_player_stats_session_kills on public.player_stats using btree (session_id, kills desc) TABLESPACE pg_default;

create index IF not exists idx_player_stats_session_covering on public.player_stats using btree (

  session_id,

  kills desc,

  name,

  deaths,

  player_honor,

  "time"

) TABLESPACE pg_default;

create index IF not exists idx_player_stats_name_map_time on public.player_stats using btree (lower(name), map, "time" desc) TABLESPACE pg_default;

create index IF not exists idx_player_stats_session_id on public.player_stats using btree (session_id) TABLESPACE pg_default;

create index IF not exists idx_player_stats_name on public.player_stats using btree (name) TABLESPACE pg_default;

create index IF not exists idx_player_stats_time on public.player_stats using btree ("time" desc) TABLESPACE pg_default;



create table public.game_sessions (

  session_id text not null,

  peak_players integer not null,

  duration integer not null,

  time_started timestamp without time zone not null,

  time_finished timestamp without time zone not null,

  map text not null,

  server_ip text not null,

  server_name text not null,

  created_at timestamp without time zone not null default now(),

  constraint game_sessions_pkey primary key (session_id)

) TABLESPACE pg_default;

create index IF not exists idx_game_sessions_active on public.game_sessions using btree (time_finished, time_started desc) TABLESPACE pg_default

where

  (time_finished is null);

create index IF not exists idx_game_sessions_server_time on public.game_sessions using btree (server_ip, time_started desc) TABLESPACE pg_default;

create index IF not exists idx_game_sessions_map_time on public.game_sessions using btree (map, time_started desc) TABLESPACE pg_default;

create index IF not exists idx_game_sessions_time_range on public.game_sessions using btree (time_started desc, time_finished) TABLESPACE pg_default;

create index IF not exists idx_game_sessions_covering on public.game_sessions using btree (

  time_started desc,

  session_id,

  server_ip,

  map,

  peak_players

) TABLESPACE pg_default

where

  (time_finished is not null);

create index IF not exists idx_game_sessions_time_started on public.game_sessions using btree (time_started desc) TABLESPACE pg_default;
