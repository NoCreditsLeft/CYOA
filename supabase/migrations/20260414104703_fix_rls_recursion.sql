-- Fix infinite RLS recursion on cyoa.allowlist.
--
-- Original is_allowed()/is_owner() did `SELECT FROM cyoa.allowlist` under the
-- caller's role, which re-triggered the allowlist RLS policy, which called
-- is_allowed() again, producing "stack depth limit exceeded".
--
-- Marking the helpers SECURITY DEFINER lets them run as the function owner
-- and bypass RLS for the allowlist lookup only.

create or replace function cyoa.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = cyoa, public
as $$
  select exists (
    select 1 from cyoa.allowlist where wallet_address = cyoa.current_wallet()
  )
$$;

create or replace function cyoa.is_owner()
returns boolean
language sql
stable
security definer
set search_path = cyoa, public
as $$
  select exists (
    select 1 from cyoa.allowlist
    where wallet_address = cyoa.current_wallet() and role = 'owner'
  )
$$;

notify pgrst, 'reload schema';
