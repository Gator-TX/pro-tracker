create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  first_name text,
  last_name text,
  title text,
  phone text,
  email text,
  is_primary boolean default false,
  created_at timestamp with time zone default now()
);
