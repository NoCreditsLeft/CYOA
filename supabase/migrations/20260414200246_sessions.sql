-- Session tokens for server-mediated wallet auth.
-- A Vercel serverless function verifies a wallet signature once, inserts
-- a row here, and returns the token. Subsequent API calls present the
-- token in the Authorization header; the function looks up the row to
-- resolve the wallet, then performs the DB op using the service role.

create table cyoa.sessions (
  token text primary key,
  wallet_address text not null references cyoa.allowlist(wallet_address) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now()
);

create index sessions_wallet_idx on cyoa.sessions(wallet_address);
create index sessions_expires_idx on cyoa.sessions(expires_at);

alter table cyoa.sessions enable row level security;

-- No policies: anon/authenticated get nothing. Only service_role can read/write.
