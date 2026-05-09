-- profiles table (extends auth.users)
create table if not exists public.profiles (
  id             uuid references auth.users(id) on delete cascade primary key,
  email          text,
  wallet_address text unique,
  created_at     timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, wallet_address)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'wallet_address'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
