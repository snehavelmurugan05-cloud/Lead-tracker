-- =========================================================================
-- SUPABASE DATABASE SCHEMA
-- =========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clean reset: drop existing tables
drop table if exists enquiries, courses, categories cascade;

-- 1. CATEGORIES TABLE
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique -- 'Technologies', 'Academy'
);

-- 2. COURSES TABLE
create table courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  name text not null, -- e.g. 'Full Stack Developer'
  fee text not null, -- e.g. '₹45,000' or '₹8,000/month'
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

-- 3. ENQUIRIES TABLE
create table enquiries (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  contact_phone text,
  category_id uuid references categories(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  fee_shared boolean default false,
  notes text,
  interested boolean, -- null = not yet determined
  follow_up_done boolean, -- null = not yet determined
  can_follow_up boolean, -- null = not yet determined
  next_reminder_at timestamptz default (now() + interval '2 days'),
  last_reminded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger to automatically update `updated_at` on enquiry changes
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_enquiries_updated_at
  before update on enquiries
  for each row
  execute function update_updated_at_column();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allow read/write access for application users (both authenticated and anonymous)
-- =========================================================================

alter table categories enable row level security;
alter table courses enable row level security;
alter table enquiries enable row level security;

-- Policies for Categories
create policy "Allow read for all"
  on categories for select
  using (true);

create policy "Allow write for all"
  on categories for all
  using (true)
  with check (true);

-- Policies for Courses
create policy "Allow read for all"
  on courses for select
  using (true);

create policy "Allow write for all"
  on courses for all
  using (true)
  with check (true);

-- Policies for Enquiries
create policy "Allow read for all"
  on enquiries for select
  using (true);

create policy "Allow write for all"
  on enquiries for all
  using (true)
  with check (true);

-- =========================================================================
-- INDEXES FOR PERFORMANCE
-- =========================================================================
create index idx_enquiries_unresolved 
  on enquiries (contact_name) 
  where (interested is null or follow_up_done is null or can_follow_up is null);

create index idx_enquiries_reminder 
  on enquiries (next_reminder_at) 
  where (interested is null or follow_up_done is null or can_follow_up is null);

-- =========================================================================
-- EMPLOYEE TASKS
-- =========================================================================
create table if not exists public.employee_tasks (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  title text not null,
  description text,
  priority text default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed')),
  due_date date not null,
  assigned_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for employee_tasks
alter table public.employee_tasks enable row level security;

create policy "Allow read for all employee_tasks"
  on public.employee_tasks for select
  using (true);

create policy "Allow insert for all employee_tasks"
  on public.employee_tasks for insert
  with check (true);

create policy "Allow update for all employee_tasks"
  on public.employee_tasks for update
  using (true)
  with check (true);

create policy "Allow delete for all employee_tasks"
  on public.employee_tasks for delete
  using (true);
