-- Spotify Web API/OAuth beta was removed by owner request.
-- Spotify's consent-first official iframe embeds use existing profile links only.
-- There were no connected Spotify accounts in the production table at removal time.
drop function if exists public.spotify_private_save(uuid,text,text,text,timestamptz);
drop function if exists public.spotify_private_rotate(uuid,text,text,text,timestamptz);
drop function if exists public.spotify_private_invalidate(uuid);
drop function if exists public.spotify_private_claim(text);
drop function if exists public.spotify_private_cache(uuid,jsonb,integer);
drop function if exists public.spotify_public_enabled(text);
drop function if exists public.spotify_my_connection();
drop function if exists public.spotify_set_visibility(boolean);
drop function if exists public.spotify_disconnect();
drop table if exists snoozer.spotify_connections;
