-- =========================================================================
-- SUPABASE SEED DATA
-- Seeds the initial categories and courses catalog
-- =========================================================================

-- 1. SEED CATEGORIES WITH STATIC UUIDs
insert into categories (id, name) values
  ('7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Technologies'),
  ('8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'Academy')
on conflict (name) do nothing;

-- 2. SEED COURSES LINKED TO ABOVE UUIDs
insert into courses (category_id, name, fee, description, active) values
  -- Technologies
  ('7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Full Stack Developer', '₹45,000', 'Frontend and Backend development covering HTML/CSS, React, Node.js, and SQL databases.', true),
  ('7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Data Science & AI', '₹60,000', 'Python analytics, predictive models, machine learning packages, and generative AI integrations.', true),
  ('7c9b8f2c-6330-4e31-8933-5c0ef1db171f', 'Machine Learning', '₹50,000', 'Advanced deep learning, artificial neural networks, computer vision, and natural language processing.', true),
  
  -- Academy
  ('8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'NEET Coaching', '₹1,20,000/year', 'Thorough exam preparation curriculum for MBBS/BDS seekers including biology, physics, and chemistry.', true),
  ('8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'JEE Coaching', '₹1,30,000/year', 'Elite test preparation coaching for IIT aspirants targeting JEE Main and Advanced admissions.', true),
  ('8b9b8f2c-6330-4e31-8933-5c0ef1db172f', 'German Language Classes', '₹15,000/level', 'Formal instruction covering Goethe levels A1 through B2, tailored for study-abroad students.', true)
on conflict do nothing;

-- 3. SEED NOTES (Admin Operational Notes & 16 Sales Pipeline Records)
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

  -- Sales Notes (Client sales & counseling ledger)
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
