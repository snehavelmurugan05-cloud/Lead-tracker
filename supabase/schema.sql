-- =========================================================================
-- COMPLETE SUPABASE DATABASE SCHEMA & SEED DATA (SINGLE UNIFIED FILE)
-- AI Enquiry Tracker, Task Management & Employee Portal
-- =========================================================================

-- Enable Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================================
-- 1. CLEAN RESET: DROP EXISTING TABLES IN REVERSE DEPENDENCY ORDER
-- =========================================================================
drop table if exists employee_daily_reports cascade;
drop table if exists employee_tasks cascade;
drop table if exists employees cascade;
drop table if exists notes cascade;
drop table if exists enquiries cascade;
drop table if exists courses cascade;
drop table if exists categories cascade;
drop table if exists app_settings cascade;

-- =========================================================================
-- 2. TRIGGER FUNCTION FOR AUTO-UPDATING `updated_at` TIMESTAMP
-- =========================================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================================
-- 3. TABLES DEFINITION
-- =========================================================================

-- -------------------------------------------------------------------------
-- TABLE 1: CATEGORIES
-- -------------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- -------------------------------------------------------------------------
-- TABLE 2: COURSES
-- -------------------------------------------------------------------------
create table courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  name text not null,
  fee text not null,
  description text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_courses_updated_at
  before update on courses
  for each row
  execute function update_updated_at_column();

-- -------------------------------------------------------------------------
-- TABLE 3: ENQUIRIES (Leads, Follow-ups & Student Enrollments)
-- -------------------------------------------------------------------------
create table enquiries (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  contact_phone text,
  category_id uuid references categories(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  fee_shared boolean default false,
  payment text default 'Pending', -- 'Pending', 'Partially Paid', 'Completed'
  notes text,
  interested boolean default null, -- null = unresolved
  follow_up_done boolean default null, -- null = unresolved
  can_follow_up boolean default null, -- null = unresolved
  next_reminder_at timestamptz default (now() + interval '2 days'),
  last_reminded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_enquiries_updated_at
  before update on enquiries
  for each row
  execute function update_updated_at_column();

-- -------------------------------------------------------------------------
-- TABLE 4: EMPLOYEES (Staff Directory & Portal Accounts)
-- -------------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text unique,
  password text,
  pan_doc_name text, -- Obfuscated/encoded password storage fallback
  email text unique,
  contact_number text,
  role text default 'Employee',
  age text,
  address text,
  aadhar_number text,
  pan_number text,
  aadhar_doc_url text,
  pan_doc_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_employees_updated_at
  before update on employees
  for each row
  execute function update_updated_at_column();

-- -------------------------------------------------------------------------
-- TABLE 5: EMPLOYEE TASKS (Assigned Tasks & Progress Tracking)
-- -------------------------------------------------------------------------
create table employee_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade not null,
  title text not null,
  description text,
  priority text default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed')),
  due_date date not null,
  assigned_by text default 'Admin',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_employee_tasks_updated_at
  before update on employee_tasks
  for each row
  execute function update_updated_at_column();

-- -------------------------------------------------------------------------
-- TABLE 6: EMPLOYEE DAILY REPORTS (Long-Term Work Archive)
-- -------------------------------------------------------------------------
create table employee_daily_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade not null,
  employee_name text not null,
  report_date date not null,
  today_updates text not null,
  challenges_blockers text,
  plan_for_tomorrow text,
  hours_worked numeric(4, 2) default 8.0,
  status text default 'Submitted' check (status in ('Submitted', 'Reviewed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_employee_daily_report unique (employee_id, report_date)
);

create trigger update_employee_daily_reports_updated_at
  before update on employee_daily_reports
  for each row
  execute function update_updated_at_column();

-- -------------------------------------------------------------------------
-- TABLE 7: NOTES (Admin Operational Notes & Sales Pipeline Cards)
-- -------------------------------------------------------------------------
create table notes (
  id text primary key default ('note-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  content text not null,
  role text default 'admin' check (role in ('admin', 'sales')),
  stage text, -- Sales funnel stages: 'Target Customer', 'Lead Generation', 'Demo', 'Requirement Gathering', 'Estimation', 'Proposal', 'Customer Onboarding', 'Reached Out', 'Pipeline', 'Converted', 'To Be Follow Up', 'Delivery Due'
  action_item text,
  is_completed boolean default false,
  created_by text default 'Admin',
  "reminderDate" text, -- Due / Reminder date (YYYY-MM-DD)
  is_pinned boolean default false,
  timestamp timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_notes_updated_at
  before update on notes
  for each row
  execute function update_updated_at_column();

-- -------------------------------------------------------------------------
-- TABLE 8: APP SETTINGS (System Configuration & Third-Party Keys)
-- -------------------------------------------------------------------------
create table app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz default now()
);

create trigger update_app_settings_updated_at
  before update on app_settings
  for each row
  execute function update_updated_at_column();

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS and grant full read/write access to application clients
-- =========================================================================
alter table categories enable row level security;
alter table courses enable row level security;
alter table enquiries enable row level security;
alter table employees enable row level security;
alter table employee_tasks enable row level security;
alter table employee_daily_reports enable row level security;
alter table notes enable row level security;
alter table app_settings enable row level security;

-- Policies for Categories
create policy "Allow read for categories" on categories for select using (true);
create policy "Allow insert for categories" on categories for insert with check (true);
create policy "Allow update for categories" on categories for update using (true) with check (true);
create policy "Allow delete for categories" on categories for delete using (true);

-- Policies for Courses
create policy "Allow read for courses" on courses for select using (true);
create policy "Allow insert for courses" on courses for insert with check (true);
create policy "Allow update for courses" on courses for update using (true) with check (true);
create policy "Allow delete for courses" on courses for delete using (true);

-- Policies for Enquiries
create policy "Allow read for enquiries" on enquiries for select using (true);
create policy "Allow insert for enquiries" on enquiries for insert with check (true);
create policy "Allow update for enquiries" on enquiries for update using (true) with check (true);
create policy "Allow delete for enquiries" on enquiries for delete using (true);

-- Policies for Employees
create policy "Allow read for employees" on employees for select using (true);
create policy "Allow insert for employees" on employees for insert with check (true);
create policy "Allow update for employees" on employees for update using (true) with check (true);
create policy "Allow delete for employees" on employees for delete using (true);

-- Policies for Employee Tasks
create policy "Allow read for employee_tasks" on employee_tasks for select using (true);
create policy "Allow insert for employee_tasks" on employee_tasks for insert with check (true);
create policy "Allow update for employee_tasks" on employee_tasks for update using (true) with check (true);
create policy "Allow delete for employee_tasks" on employee_tasks for delete using (true);

-- Policies for Employee Daily Reports
create policy "Allow read for employee_daily_reports" on employee_daily_reports for select using (true);
create policy "Allow insert for employee_daily_reports" on employee_daily_reports for insert with check (true);
create policy "Allow update for employee_daily_reports" on employee_daily_reports for update using (true) with check (true);
create policy "Allow delete for employee_daily_reports" on employee_daily_reports for delete using (true);

-- Policies for Notes
create policy "Allow read for notes" on notes for select using (true);
create policy "Allow insert for notes" on notes for insert with check (true);
create policy "Allow update for notes" on notes for update using (true) with check (true);
create policy "Allow delete for notes" on notes for delete using (true);

-- Policies for App Settings
create policy "Allow read for app_settings" on app_settings for select using (true);
create policy "Allow insert for app_settings" on app_settings for insert with check (true);
create policy "Allow update for app_settings" on app_settings for update using (true) with check (true);
create policy "Allow delete for app_settings" on app_settings for delete using (true);

-- =========================================================================
-- 5. PERFORMANCE INDEXES
-- =========================================================================
create index if not exists idx_courses_category on courses (category_id);
create index if not exists idx_courses_active on courses (active);
create index if not exists idx_enquiries_category on enquiries (category_id);
create index if not exists idx_enquiries_course on enquiries (course_id);
create index if not exists idx_enquiries_contact on enquiries (contact_name);
create index if not exists idx_enquiries_unresolved on enquiries (interested, follow_up_done, can_follow_up);
create index if not exists idx_enquiries_reminder on enquiries (next_reminder_at);
create index if not exists idx_employees_email on employees (email);
create index if not exists idx_employees_username on employees (username);
create index if not exists idx_tasks_employee on employee_tasks (employee_id);
create index if not exists idx_tasks_status on employee_tasks (status);
create index if not exists idx_tasks_due on employee_tasks (due_date);
create index if not exists idx_reports_employee on employee_daily_reports (employee_id);
create index if not exists idx_reports_date on employee_daily_reports (report_date);
create index if not exists idx_notes_role on notes (role);
create index if not exists idx_notes_completed on notes (is_completed);

-- =========================================================================
-- 6. SUPABASE STORAGE BUCKET CONFIGURATION (Aadhaar & PAN Documents)
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('employee-docs', 'employee-docs', true)
on conflict (id) do nothing;

create policy "Allow public storage access for employee-docs"
  on storage.objects for select
  using (bucket_id = 'employee-docs');

create policy "Allow public storage upload for employee-docs"
  on storage.objects for insert
  with check (bucket_id = 'employee-docs');

create policy "Allow public storage update for employee-docs"
  on storage.objects for update
  using (bucket_id = 'employee-docs');

create policy "Allow public storage delete for employee-docs"
  on storage.objects for delete
  using (bucket_id = 'employee-docs');

-- =========================================================================
-- 7. COMPREHENSIVE SEED DATA FOR ALL TABLES
-- =========================================================================

-- -------------------------------------------------------------------------
-- SEED 1: CATEGORIES
-- -------------------------------------------------------------------------
insert into categories (id, name) values
  ('7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Technologies'),
  ('8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'Academy')
on conflict (name) do nothing;

-- -------------------------------------------------------------------------
-- SEED 2: COURSES
-- -------------------------------------------------------------------------
insert into courses (id, category_id, name, fee, description, active) values
  -- Technologies
  ('11111111-1111-1111-1111-111111111111', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Full Stack Developer', '₹45,000', 'Frontend and Backend development covering HTML/CSS, React, Node.js, and SQL databases.', true),
  ('22222222-2222-2222-2222-222222222222', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Data Science & AI', '₹60,000', 'Python analytics, predictive models, machine learning packages, and generative AI integrations.', true),
  ('33333333-3333-3333-3333-333333333333', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Machine Learning', '₹50,000', 'Advanced deep learning, artificial neural networks, computer vision, and natural language processing.', true),
  
  -- Academy
  ('44444444-4444-4444-4444-444444444444', '8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'NEET Coaching', '₹1,20,000/year', 'Thorough exam preparation curriculum for MBBS/BDS seekers including biology, physics, and chemistry.', true),
  ('55555555-5555-5555-5555-555555555555', '8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'JEE Coaching', '₹1,30,000/year', 'Elite test preparation coaching for IIT aspirants targeting JEE Main and Advanced admissions.', true),
  ('66666666-6666-6666-6666-666666666666', '8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'German Language Classes', '₹15,000/level', 'Formal instruction covering Goethe levels A1 through B2, tailored for study-abroad students.', true)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- SEED 3: EMPLOYEES (Initial Staff Accounts)
-- -------------------------------------------------------------------------
insert into employees (id, name, username, password, pan_doc_name, email, contact_number, role, age, address) values
  ('a0000000-0000-0000-0000-000000000001', 'Sneha', 'sneha', 'password123', 'AUTH_KEY:cGFzc3dvcmQxMjM=', 'sneha@globalminds.com', '+91 98765 12345', 'Frontend & Full Stack Developer', '24', 'OMR, Chennai, Tamil Nadu'),
  ('a0000000-0000-0000-0000-000000000002', 'Rahul Sharma', 'rahul', 'password123', 'AUTH_KEY:cGFzc3dvcmQxMjM=', 'rahul@globalminds.com', '+91 98765 67890', 'Lead Academic Counselor', '28', 'HSR Layout, Bangalore, Karnataka')
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- SEED 4: ENQUIRIES (Sample Leads, Follow-ups & Student Enrollments)
-- -------------------------------------------------------------------------
insert into enquiries (id, contact_name, contact_phone, category_id, course_id, fee_shared, payment, notes, interested, follow_up_done, can_follow_up, next_reminder_at, last_reminded_at, created_at, updated_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Ashok Kumar', '+91 98765 43210', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '11111111-1111-1111-1111-111111111111', true, 'Completed', 'Interested in evening batch. Inquired via call.', true, true, true, now() - interval '1 day', null, now() - interval '3 days', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000002', 'Priya Sharma', '+91 87654 32109', '8b9b8f2c-6330-4e31-8933-5c0ef1db172f', '44444444-4444-4444-4444-444444444444', false, 'Pending', 'Parent called. Asked for demo class schedule.', null, null, null, now() + interval '1 day', null, now() - interval '1 day', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000003', 'Rahul Verma', '+91 98111 22334', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '11111111-1111-1111-1111-111111111111', true, 'Partially Paid', 'Requested weekend offline batches and syllabus breakdown.', true, true, true, now() + interval '2 days', null, now() - interval '8 days', now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000004', 'Sneha Patel', '+91 97234 56789', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '22222222-2222-2222-2222-222222222222', true, 'Completed', 'Looking for Generative AI module and career placement support.', true, true, true, now() + interval '3 days', null, now() - interval '12 days', now() - interval '12 days'),
  ('b0000000-0000-0000-0000-000000000005', 'Karthik Raja', '+91 98450 12345', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '11111111-1111-1111-1111-111111111111', true, 'Completed', 'Enrolled in full stack developer batch last month. [CONVERTED]', true, true, false, now() - interval '25 days', null, now() - interval '35 days', now() - interval '35 days'),
  ('b0000000-0000-0000-0000-000000000006', 'Ananya Iyer', '+91 99887 65432', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '11111111-1111-1111-1111-111111111111', false, 'Pending', 'Inquired about React & Node curriculum last month.', null, null, null, now() - interval '30 days', null, now() - interval '42 days', now() - interval '42 days'),
  ('b0000000-0000-0000-0000-000000000007', 'Vikram Singh', '+91 91234 56780', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '22222222-2222-2222-2222-222222222222', true, 'Partially Paid', 'Joined Data Science cohort last month.', true, true, true, now() - interval '28 days', null, now() - interval '38 days', now() - interval '38 days'),
  ('b0000000-0000-0000-0000-000000000008', 'Meera Nair', '+91 94440 98765', '8b9b8f2c-6330-4e31-8933-5c0ef1db172f', '44444444-4444-4444-4444-444444444444', true, 'Completed', 'Admitted in NEET crash batch last month. [CONVERTED]', true, true, false, now() - interval '32 days', null, now() - interval '40 days', now() - interval '40 days'),
  ('b0000000-0000-0000-0000-000000000009', 'Rohan Gupta', '+91 93322 11009', '7c9b8f2c-6330-4e31-8933-5c0ef1db171f', '11111111-1111-1111-1111-111111111111', true, 'Completed', 'Enrolled 2 months back. Course in progress.', true, true, true, now() - interval '60 days', null, now() - interval '68 days', now() - interval '68 days'),
  ('b0000000-0000-0000-0000-000000000010', 'Divya Krishnan', '+91 95566 77889', '8b9b8f2c-6330-4e31-8933-5c0ef1db172f', '55555555-5555-5555-5555-555555555555', true, 'Completed', 'JEE 1-year foundation registration 2 months ago. [CONVERTED]', true, true, false, now() - interval '62 days', null, now() - interval '72 days', now() - interval '72 days')
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- SEED 5: NOTES (Admin Operational Notes & Sales Pipeline Notes)
-- -------------------------------------------------------------------------
insert into notes (id, content, role, stage, action_item, is_completed, created_by, "reminderDate", timestamp) values
  -- Admin Notes
  ('note-admin-1', 'Contacted municipal authority regarding annual campus fire safety and emergency compliance audit renewal.', 'admin', null, 'Pending', false, 'Admin', (current_date + interval '1 day')::text, now() - interval '30 minutes'),
  ('note-admin-2', 'Sent inquiry to facilities vendor for classroom projector upgrades and air-conditioning maintenance servicing.', 'admin', null, 'Pending', false, 'Admin', (current_date + interval '2 days')::text, now() - interval '2 hours'),
  ('note-admin-3', 'Requested updated quotation from telecom provider for dedicated leased-line internet bandwidth upgrade.', 'admin', null, 'Pending', false, 'Admin', null, now() - interval '4 hours'),
  ('note-admin-4', 'Reviewing proposal for campus biometric security access system and cloud attendance software integration.', 'admin', null, 'Pending', false, 'Admin', (current_date + interval '1 day')::text, now() - interval '14 hours'),
  ('note-admin-5', 'Evaluating vendor bids for cafeteria catering service contract and health inspection certification.', 'admin', null, 'Pending', false, 'Admin', null, now() - interval '18 hours'),
  ('note-admin-6', 'Annual branch commercial property insurance policy successfully renewed and premium transaction finalized.', 'admin', null, 'Completed', true, 'Admin', null, now() - interval '32 hours'),
  ('note-admin-7', 'Quarterly staff payroll reconciliation and statutory tax withholding compliance documentation approved.', 'admin', null, 'Completed', true, 'Admin', null, now() - interval '36 hours'),
  ('note-admin-8', 'Follow-up with IT infrastructure team on Sunday server maintenance and offsite data backup log verification.', 'admin', null, 'Pending', false, 'Admin', (current_date + interval '1 day')::text, now() - interval '40 hours'),
  ('note-admin-9', 'Meeting with external legal counsel regarding employee nondisclosure agreements and vendor terms update.', 'admin', null, 'Pending', false, 'Admin', (current_date + interval '3 days')::text, now() - interval '44 hours'),
  ('note-admin-10', 'Quarterly compliance filing documentation delivery due to regional education board office.', 'admin', null, 'Pending', false, 'Admin', current_date::text, now() - interval '48 hours'),

  -- Sales Notes (Sales Desk Ledger)
  ('sales-note-20261014-01', 'LinkedIn Partnerships: Sent 2 partnership proposal emails to companies identified through LinkedIn.', 'sales', 'Proposal', 'Proposal', false, 'Sales Desk', '2026-10-14', '2026-10-14 09:30:00+00'),
  ('sales-note-20261014-02', 'Upwork Verification: Discussed and clarified Upwork membership verification requirements with the team.', 'sales', 'Requirement Gathering', 'Requirement Gathering', false, 'Sales Desk', '2026-10-14', '2026-10-14 10:00:00+00'),
  ('sales-note-20261014-03', 'Website Development Leads: Sent response emails for website development opportunities identified on LinkedIn.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 10:30:00+00'),
  ('sales-note-20261014-04', 'Business Development: Searched LinkedIn for additional business opportunities and established new professional connections.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 11:15:00+00'),
  ('sales-note-20261014-05', 'Team Coordination: Discussed outreach activities with Hamsalekha and assigned the day''s outreach tasks.', 'sales', 'Requirement Gathering', 'Requirement Gathering', false, 'Sales Desk', '2026-10-14', '2026-10-14 12:00:00+00'),
  ('sales-note-20261014-06', 'Facebook Business Setup: Created the company''s Facebook business page and updated the official profile.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 12:30:00+00'),
  ('sales-note-20261014-07', 'Facebook Community Engagement: Published promotional posts and joined relevant active business networking groups.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 14:00:00+00'),
  ('sales-note-20261014-08', 'ACME Global Outreach: Sent a partnership and business opportunity email to ACME Global, as advised by Arun.', 'sales', 'Proposal', 'Proposal', false, 'Sales Desk', '2026-10-14', '2026-10-14 14:30:00+00'),
  ('sales-note-20261014-09', 'School Data Research - Chennai: Generated targeted contact email lists for 25 target schools across Chennai using AI-powered search tools.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 15:00:00+00'),
  ('sales-note-20261014-10', 'School Data Research - Madurai: Generated targeted contact email lists for 15 target schools across Madurai using AI-powered search tools.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 15:30:00+00'),
  ('sales-note-20261014-11', 'Email List Validation: Completed pre-validation and deliverability verification of all 40 generated school email IDs to improve inbox deliverability.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 16:00:00+00'),
  ('sales-note-20261014-12', 'Chennai Outreach: Dispatched targeted cold outreach emails to 25 preschools in Chennai, focusing on website redesign and online enquiry tracking solutions.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 16:30:00+00'),
  ('sales-note-20261014-13', 'Madurai Outreach: Sent targeted cold outreach emails to 15 schools in Madurai, highlighting Admissions CRM and automated fee management solutions.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 17:00:00+00'),
  ('sales-note-20261014-14', 'Email Optimization & Verification: Tailored email pitches to address the specific technology needs of each school segment and ensured contact accuracy before dispatch.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-14 17:30:00+00'),
  ('sales-note-1', 'Researching Linkedin and getting connects and looking for leads. Have showed interest for one job post and replied with our portfolio.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-13 10:00:00+00'),
  ('sales-note-2', 'Profile update in Upwork. Have clarified the issue with suspension is under review as the verification process takes time.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-13 09:30:00+00'),
  ('sales-note-3', 'Handling Upwork account issue', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', null, '2026-10-13 09:00:00+00'),
  ('sales-note-4', 'Making Bids in Freelancer for the posted opprtnities.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', null, '2026-10-13 08:30:00+00'),
  ('sales-note-5', 'Priority mails for 15 companies (provided by Ganesh Senthil) has been sent.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-14', '2026-10-13 07:30:00+00'),
  ('sales-note-6', 'Have made a bid in Freelancer.in for website development project.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-13', '2026-10-12 16:00:00+00'),
  ('sales-note-7', 'Created a profile in Freelancer site as suggested by Hamsalekha.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', null, '2026-10-12 14:30:00+00'),
  ('sales-note-8', 'KT and Task assigned to Hamsalekha.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', null, '2026-10-12 12:00:00+00'),
  ('sales-note-9', 'Had a Team meeting this morning and discussed the pipeline and action needed items.', 'sales', 'Requirement Gathering', 'Requirement Gathering', false, 'Sales Desk', null, '2026-10-12 10:00:00+00'),
  ('sales-note-10', 'Contacted Saranya -Event Management client with Website requirement. She will be calling back in few minutes.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', null, '2026-10-12 09:30:00+00'),
  ('sales-note-11', 'Confirmed a final Quote for NIVI on added feature. Have scheduled a call in 30 mins.', 'sales', 'Estimation', 'Estimation', false, 'Sales Desk', '2026-10-12', '2026-10-12 14:30:00+00'),
  ('sales-note-12', 'Following up NIVI for additional features request and clarifying their exact needs to asses if it''s in scope.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-10', '2026-10-10 11:15:00+00'),
  ('sales-note-13', 'Successfully completed outreach for GMT''s key digital products — Security Services, Boutique Business, and Sports Academy solutions — reaching out to 40 prospective contacts to generate leads, build awareness, and explore potential business opportunities. WhatsApp messages to 24 contacts were done as well.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-09', '2026-10-09 16:45:00+00'),
  ('sales-note-14', 'Called Khaleel - Madurai Department store owner for meeting up tomorrow for Sales pitch. Going along with Shanthini. Client has asked to confirm tomorrow morning.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-10', '2026-10-09 14:20:00+00'),
  ('sales-note-15', 'Called and cancelled today''s interview for the 2 prospects.', 'sales', 'Lead Generation', 'Lead Generation', false, 'Sales Desk', '2026-10-09', '2026-10-09 10:00:00+00'),
  ('sales-note-16', 'Contacted 25 client prospects through mail and Whatsapp messages.', 'sales', 'Proposal', 'Proposal', false, 'Sales Desk', '2026-10-06', '2026-10-06 12:00:00+00')
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- SEED 6: EMPLOYEE TASKS
-- -------------------------------------------------------------------------
insert into employee_tasks (id, employee_id, title, description, priority, status, due_date, assigned_by, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Complete Lead tracker payment dropdown and note action items', 'Updated fee shared label to details shared, added payment dropdown, and placed action items column directly next to note content.', 'High', 'Completed', current_date, 'Admin', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Develop Employee portal and daily reporting module', 'Build role-based employee login, task isolation view, and long-term daily report submission and historical archive.', 'High', 'In Progress', (current_date + interval '1 day'), 'Admin', now()),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Perform cross-browser responsiveness audit on mobile tablets', 'Verify navigation drawers, tables, and voice note microphone inputs on iPad and Android screen sizes.', 'Medium', 'Pending', (current_date + interval '2 days'), 'Admin', now()),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Follow up with 5 prospective NEET & JEE counseling enquiries', 'Schedule demo counseling sessions and outline course fee breakdown.', 'Medium', 'In Progress', current_date, 'Admin', now() - interval '1 day')
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- SEED 7: EMPLOYEE DAILY REPORTS
-- -------------------------------------------------------------------------
insert into employee_daily_reports (id, employee_id, employee_name, report_date, today_updates, challenges_blockers, plan_for_tomorrow, hours_worked, status, created_at) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sneha', (current_date - interval '1 day')::date, '1. Upgraded Fee Shared column into Details Shared across all lead trackers.\n2. Implemented Payment dropdown with values (Partially Paid, Pending, Completed).\n3. Handled Supabase column fallback for seamless schema compatibility.', 'None. All automated unit validations and TypeScript builds passed.', 'Position Action Item column in Notes table and begin Employee portal architecture.', 8.0, 'Reviewed', now() - interval '1 day'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Sneha', (current_date - interval '2 days')::date, '1. Built Recent Notes pagination and row-per-page selector.\n2. Tested speech-to-text voice notes microphone recording.\n3. Verified student tuition conversion calculations in Conversion module.', 'Browser Web Speech API permissions required initial user gesture.', 'Enhance lead status alerts and follow-up reminders.', 7.5, 'Reviewed', now() - interval '2 days')
on conflict on constraint uq_employee_daily_report do nothing;

-- -------------------------------------------------------------------------
-- SEED 8: APP SETTINGS (System Default Configurations)
-- -------------------------------------------------------------------------
insert into app_settings (key, value, description) values
  ('resend_api_key', '', 'API Key for Resend automated employee task emails'),
  ('theme', 'light', 'Default application color theme'),
  ('system_title', 'Global Minds Management System', 'Institutional system title')
on conflict (key) do nothing;

-- =========================================================================
-- END OF SCHEMA & SEED SCRIPT
-- =========================================================================
