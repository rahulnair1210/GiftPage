-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.gifts (
  id              text primary key,
  edit_key_hash   text not null,
  status          text not null default 'draft' check (status in ('draft','pending','paid','disabled')),
  slug            text unique,
  pending_slug    text,
  config          jsonb not null default '{}'::jsonb,
  unlock_at       timestamptz,
  email           text,
  phone           text,
  amount          integer,
  currency        text default 'INR',
  order_id        text unique,
  payment_id      text,
  photo_paths     jsonb not null default '[]'::jsonb,
  paid_at         timestamptz,
  emailed_at      timestamptz,
  expires_at      timestamptz,
  disabled_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists gifts_status_updated_idx on public.gifts (status, updated_at);
create index if not exists gifts_expires_idx on public.gifts (expires_at) where status = 'paid';
create index if not exists gifts_pending_slug_idx on public.gifts (pending_slug) where status = 'pending';

create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  slug       text not null,
  reason     text,
  details    text,
  created_at timestamptz not null default now()
);

-- Lock the tables: with RLS on and no policies, only the server (service role key) can read or write.
alter table public.gifts   enable row level security;
alter table public.reports enable row level security;

-- Public bucket for gift photos. File names are random, and the server only reveals URLs after a gift opens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gift-photos', 'gift-photos', true, 3000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
