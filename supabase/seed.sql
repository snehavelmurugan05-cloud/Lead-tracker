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
