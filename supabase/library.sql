-- Run in the Supabase SQL Editor. Do not put private files or service keys in Git.
-- The owner account is added separately after its first email sign-in.

create schema if not exists private;

create table if not exists private.library_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function private.is_library_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.library_owners
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_library_owner() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_library_owner() to authenticated;

create or replace function public.is_library_owner()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_library_owner();
$$;

revoke all on function public.is_library_owner() from public;
grant execute on function public.is_library_owner() to authenticated;

create table if not exists public.library_documents (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  visibility text not null check (visibility in ('public', 'private')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  object_path text not null,
  created_at timestamptz not null default now(),
  constraint library_documents_path_check check (
    object_path like owner_id::text || '/' || id::text || '.%'
  )
);

create index if not exists library_documents_created_at_idx
  on public.library_documents (created_at desc);

alter table public.library_documents enable row level security;
revoke all on public.library_documents from anon, authenticated;
grant select on public.library_documents to anon, authenticated;
grant insert, delete on public.library_documents to authenticated;

drop policy if exists "Read public or owned documents" on public.library_documents;
drop policy if exists "Visitors read public documents" on public.library_documents;
create policy "Visitors read public documents"
on public.library_documents for select to anon
using (visibility = 'public');

drop policy if exists "Owner reads public and private documents" on public.library_documents;
create policy "Owner reads public and private documents"
on public.library_documents for select to authenticated
using (
  visibility = 'public'
  or (owner_id = (select auth.uid()) and (select public.is_library_owner()))
);

drop policy if exists "Owner inserts documents" on public.library_documents;
create policy "Owner inserts documents"
on public.library_documents for insert to authenticated
with check (owner_id = (select auth.uid()) and (select public.is_library_owner()));

drop policy if exists "Owner deletes documents" on public.library_documents;
create policy "Owner deletes documents"
on public.library_documents for delete to authenticated
using (owner_id = (select auth.uid()) and (select public.is_library_owner()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('library-public', 'library-public', true, 52428800, array['application/octet-stream']),
  ('library-private', 'library-private', false, 52428800, array['application/octet-stream'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owner uploads library files" on storage.objects;
create policy "Owner uploads library files"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('library-public', 'library-private')
  and (select public.is_library_owner())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Owner reads library files" on storage.objects;
create policy "Owner reads library files"
on storage.objects for select to authenticated
using (
  bucket_id in ('library-public', 'library-private')
  and (select public.is_library_owner())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Owner deletes library files" on storage.objects;
create policy "Owner deletes library files"
on storage.objects for delete to authenticated
using (
  bucket_id in ('library-public', 'library-private')
  and (select public.is_library_owner())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
