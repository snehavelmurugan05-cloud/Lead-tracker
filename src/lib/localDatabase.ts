import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface Category {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  category_id: string;
  name: string;
  fee: string;
  description: string;
  active: boolean;
  created_at: string;
}

export interface Enquiry {
  id: string;
  contact_name: string;
  contact_phone: string;
  category_id: string;
  course_id: string;
  fee_shared: boolean;
  payment?: 'Pending' | 'Partially Paid' | 'Completed' | string;
  notes: string;
  interested: boolean | null;
  follow_up_done: boolean | null;
  can_follow_up: boolean | null;
  next_reminder_at: string;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NoteStage =
  | 'Cold Email Outreach'
  | 'Lead Research'
  | 'Initial Call'
  | 'Requirement Identification'
  | 'Requirement-Based Email Sent'
  | 'Partnership Proposal'
  | 'Partnership Conversation'
  | 'Partnership Followup'
  | 'Customer Onboarding'
  | 'Target Customer'
  | 'Lead Generation'
  | 'Demo'
  | 'Requirement Gathering'
  | 'Estimation'
  | 'Proposal'
  | 'Reached Out'
  | 'Pipeline'
  | 'Converted'
  | 'To Be Follow Up'
  | 'Delivery Due';

export type SalesWorkstreamCategory =
  | 'Meeting'
  | 'Team discussion'
  | 'Kt'
  | 'Cold reach'
  | 'Call'
  | 'Portfolio'
  | 'Cold Emails'
  | 'Partnership'
  | 'Research';

export const WORKSTREAM_CATEGORIES: {
  value: SalesWorkstreamCategory;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { value: 'Meeting', label: 'Meeting', icon: '👥', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', border: 'rgba(2, 132, 199, 0.35)' },
  { value: 'Team discussion', label: 'Team discussion', icon: '🗣️', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', border: 'rgba(124, 58, 237, 0.35)' },
  { value: 'Kt', label: 'Kt', icon: '💡', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.35)' },
  { value: 'Cold reach', label: 'Cold reach', icon: '🎯', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.35)' },
  { value: 'Call', label: 'Call', icon: '📞', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)', border: 'rgba(13, 148, 136, 0.35)' },
  { value: 'Portfolio', label: 'Portfolio', icon: '💼', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)', border: 'rgba(225, 29, 72, 0.35)' },
  { value: 'Cold Emails', label: 'Cold Emails', icon: '✉️', color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.12)', border: 'rgba(29, 78, 216, 0.35)' },
  { value: 'Partnership', label: 'Partnership', icon: '🤝', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)', border: 'rgba(147, 51, 234, 0.35)' },
  { value: 'Research', label: 'Research', icon: '🔍', color: '#b45309', bg: 'rgba(180, 83, 9, 0.12)', border: 'rgba(180, 83, 9, 0.35)' }
];

export interface Note {
  id: string;
  content: string;
  timestamp: string;
  role?: 'admin' | 'sales' | string;
  stage?: NoteStage | string;
  action_item?: string;
  is_completed?: boolean;
  created_by?: string;
  reminderDate?: string;
  is_pinned?: boolean;
  category?: SalesWorkstreamCategory | string;
}

export const resolveNoteCategories = (note: Note): SalesWorkstreamCategory[] => {
  if (note.category && note.category !== 'null' && note.category !== 'None' && String(note.category).trim() !== '') {
    const matched = WORKSTREAM_CATEGORIES.find(c => c.value.toLowerCase() === String(note.category).toLowerCase());
    if (matched) return [matched.value];
    return [note.category as SalesWorkstreamCategory];
  }
  const rawAction = (note.action_item || '').trim();
  if (rawAction.toLowerCase().startsWith('workstream:')) {
    const catName = rawAction.replace(/workstream:/i, '').trim();
    const matched = WORKSTREAM_CATEGORIES.find(c => c.value.toLowerCase() === catName.toLowerCase());
    if (matched) return [matched.value];
    return [catName as SalesWorkstreamCategory];
  }
  if (rawAction) {
    const matched = WORKSTREAM_CATEGORIES.find(c => c.value.toLowerCase() === rawAction.toLowerCase());
    if (matched) return [matched.value];
  }
  return [];
};

export const NOTE_STAGES: NoteStage[] = [
  'Target Customer',
  'Lead Generation',
  'Demo',
  'Requirement Gathering',
  'Estimation',
  'Proposal',
  'Customer Onboarding'
];

export const SALES_FLOW_STAGES: NoteStage[] = [
  'Target Customer',
  'Lead Generation',
  'Demo',
  'Requirement Gathering',
  'Estimation',
  'Proposal',
  'Customer Onboarding'
];

export const resolveNoteStage = (n: Note): NoteStage | null => {
  const rawStage = (n.stage || '').trim();
  if (rawStage && rawStage !== 'null' && rawStage !== 'None') {
    const matchedDirect = NOTE_STAGES.find(s => s.toLowerCase() === rawStage.toLowerCase());
    if (matchedDirect) return matchedDirect;

    const lower = rawStage.toLowerCase();
    if (lower.includes('target customer') || lower.includes('target')) return 'Target Customer';
    if (lower.includes('lead generation') || lower.includes('lead gen') || lower.includes('lead research') || lower.includes('pipeline') || lower.includes('cold email') || lower.includes('outreach') || lower.includes('reached out')) return 'Lead Generation';
    if (lower.includes('demo') || lower.includes('initial call')) return 'Demo';
    if (lower.includes('requirement gathering') || lower.includes('requirement identification') || lower.includes('gathering')) return 'Requirement Gathering';
    if (lower.includes('estimation') || lower.includes('quote') || lower.includes('requirement-based') || lower.includes('requirement based')) return 'Estimation';
    if (lower.includes('proposal') || lower.includes('pitch') || lower.includes('partnership proposal') || lower.includes('partnership conversation')) return 'Proposal';
    if (lower.includes('onboarding') || lower.includes('customer onboarding') || lower.includes('converted') || lower.includes('followup') || lower.includes('follow-up') || lower.includes('follow up') || lower.includes('delivery')) return 'Customer Onboarding';
    return rawStage as NoteStage;
  }

  // Fallback to action_item if stage is not set and action_item is not a workstream
  const rawAction = (n.action_item || '').trim();
  if (rawAction && !rawAction.toLowerCase().startsWith('workstream:') && !WORKSTREAM_CATEGORIES.some(c => c.value.toLowerCase() === rawAction.toLowerCase())) {
    const matchedDirect = NOTE_STAGES.find(s => s.toLowerCase() === rawAction.toLowerCase());
    if (matchedDirect) return matchedDirect;

    const lower = rawAction.toLowerCase();
    if (lower.includes('target customer') || lower.includes('target')) return 'Target Customer';
    if (lower.includes('lead generation') || lower.includes('lead gen') || lower.includes('lead research') || lower.includes('pipeline') || lower.includes('cold email') || lower.includes('outreach') || lower.includes('reached out')) return 'Lead Generation';
    if (lower.includes('demo') || lower.includes('initial call')) return 'Demo';
    if (lower.includes('requirement gathering') || lower.includes('requirement identification') || lower.includes('gathering')) return 'Requirement Gathering';
    if (lower.includes('estimation') || lower.includes('quote') || lower.includes('requirement-based') || lower.includes('requirement based')) return 'Estimation';
    if (lower.includes('proposal') || lower.includes('pitch') || lower.includes('partnership proposal') || lower.includes('partnership conversation')) return 'Proposal';
    if (lower.includes('onboarding') || lower.includes('customer onboarding') || lower.includes('converted') || lower.includes('followup') || lower.includes('follow-up') || lower.includes('follow up') || lower.includes('delivery')) return 'Customer Onboarding';
  }

  return null;
};

export const normalizeSalesNote = (note: Note): Note => {
  const categories = resolveNoteCategories(note);
  const resolvedCategory = (note.category && note.category !== 'null' && note.category !== 'None')
    ? (note.category as SalesWorkstreamCategory)
    : (categories[0] || undefined);
  const resolvedStage = resolveNoteStage(note) || (note.stage && note.stage !== 'null' && note.stage !== 'None' ? (note.stage as NoteStage) : undefined);
  const resolvedActionItem = note.action_item || (resolvedCategory ? `Workstream: ${resolvedCategory}` : (resolvedStage || undefined));

  return {
    ...note,
    category: resolvedCategory,
    stage: resolvedStage,
    action_item: resolvedActionItem
  };
};

export interface UserSession {
  role: 'admin' | 'employee' | 'sales';
  id?: string;
  name: string;
  username: string;
  email?: string;
  role_title?: string;
}

export interface Employee {
  id: string;
  name: string;
  username?: string;
  password?: string;
  age?: string;
  role: string;
  address?: string;
  contact_number?: string;
  email?: string;
  aadhar_number?: string;
  pan_number?: string;
  aadhar_doc_url?: string;
  pan_doc_url?: string;
  created_at?: string;
}

export interface EmployeeTask {
  id: string;
  employee_id: string;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
  due_date: string;
  assigned_by?: string;
  created_at: string;
}

export interface EmployeeDailyReport {
  id: string;
  employee_id: string;
  employee_name: string;
  report_date: string; // YYYY-MM-DD
  today_updates: string; // tasks completed and progress
  challenges_blockers?: string; // bottlenecks
  plan_for_tomorrow?: string; // plan for next day
  hours_worked?: number | string;
  status: 'Submitted' | 'Reviewed';
  created_at: string;
  updated_at?: string;
}

// Initial mock data
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-tech', name: 'Technologies' },
  { id: 'cat-academy', name: 'Academy' }
];

const DEFAULT_COURSES: Course[] = [
  {
    id: 'course-fs',
    category_id: 'cat-tech',
    name: 'Full Stack Developer',
    fee: '₹45,000',
    description: 'HTML, CSS, Javascript, React, Node.js, and SQL/NoSQL databases.',
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'course-ds',
    category_id: 'cat-tech',
    name: 'Data Science & AI',
    fee: '₹60,000',
    description: 'Python, statistical analysis, Machine Learning algorithms, and Generative AI.',
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'course-ml',
    category_id: 'cat-tech',
    name: 'Machine Learning',
    fee: '₹50,000',
    description: 'Deep learning, neural networks, computer vision, and NLP frameworks.',
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'course-neet',
    category_id: 'cat-academy',
    name: 'NEET Coaching',
    fee: '₹1,20,000/year',
    description: 'Complete coaching for national eligibility cum entrance test for medical aspirants.',
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'course-jee',
    category_id: 'cat-academy',
    name: 'JEE Coaching',
    fee: '₹1,30,000/year',
    description: 'Coaching for Joint Entrance Examination for top engineering institutions.',
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'course-german',
    category_id: 'cat-academy',
    name: 'German Language Classes',
    fee: '₹15,000/level',
    description: 'German language learning from levels A1 to B2 with certified exam practice.',
    active: true,
    created_at: new Date().toISOString()
  }
];

const DEFAULT_ENQUIRIES: Enquiry[] = [
  {
    id: 'enq-1',
    contact_name: 'Ashok Kumar',
    contact_phone: '+91 98765 43210',
    category_id: 'cat-tech',
    course_id: 'course-fs',
    fee_shared: true,
    payment: 'Completed',
    notes: 'Interested in evening batch. Inquired via call.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-2',
    contact_name: 'Priya Sharma',
    contact_phone: '+91 87654 32109',
    category_id: 'cat-academy',
    course_id: 'course-neet',
    fee_shared: false,
    payment: 'Pending',
    notes: 'Parent called. Asked for demo class schedule.',
    interested: null,
    follow_up_done: null,
    can_follow_up: null,
    next_reminder_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-3',
    contact_name: 'Rahul Verma',
    contact_phone: '+91 98111 22334',
    category_id: 'cat-tech',
    course_id: 'course-fs',
    fee_shared: true,
    payment: 'Partially Paid',
    notes: 'Requested weekend offline batches and syllabus breakdown.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-4',
    contact_name: 'Sneha Patel',
    contact_phone: '+91 97234 56789',
    category_id: 'cat-tech',
    course_id: 'course-ds',
    fee_shared: true,
    payment: 'Completed',
    notes: 'Looking for Generative AI module and career placement support.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-5',
    contact_name: 'Karthik Raja',
    contact_phone: '+91 98450 12345',
    category_id: 'cat-tech',
    course_id: 'course-fs',
    fee_shared: true,
    payment: 'Completed',
    notes: 'Enrolled in full stack developer batch last month.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // Previous month
    updated_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-6',
    contact_name: 'Ananya Iyer',
    contact_phone: '+91 99887 65432',
    category_id: 'cat-tech',
    course_id: 'course-fs',
    fee_shared: false,
    payment: 'Pending',
    notes: 'Inquired about React & Node curriculum last month.',
    interested: null,
    follow_up_done: null,
    can_follow_up: null,
    next_reminder_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString(), // Previous month
    updated_at: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-7',
    contact_name: 'Vikram Singh',
    contact_phone: '+91 91234 56780',
    category_id: 'cat-tech',
    course_id: 'course-ds',
    fee_shared: true,
    payment: 'Partially Paid',
    notes: 'Joined Data Science cohort last month.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(), // Previous month
    updated_at: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-8',
    contact_name: 'Meera Nair',
    contact_phone: '+91 94440 98765',
    category_id: 'cat-academy',
    course_id: 'course-neet',
    fee_shared: true,
    payment: 'Completed',
    notes: 'Admitted in NEET crash batch last month.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // Previous month
    updated_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-9',
    contact_name: 'Rohan Gupta',
    contact_phone: '+91 93322 11009',
    category_id: 'cat-tech',
    course_id: 'course-fs',
    fee_shared: true,
    payment: 'Completed',
    notes: 'Enrolled 2 months back. Course in progress.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000).toISOString(), // 2 months ago
    updated_at: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'enq-10',
    contact_name: 'Divya Krishnan',
    contact_phone: '+91 95566 77889',
    category_id: 'cat-academy',
    course_id: 'course-jee',
    fee_shared: true,
    payment: 'Completed',
    notes: 'JEE 1-year foundation registration 2 months ago.',
    interested: true,
    follow_up_done: true,
    can_follow_up: true,
    next_reminder_at: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
    last_reminded_at: null,
    created_at: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000).toISOString(), // 2 months ago
    updated_at: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// LocalStorage helpers
const STORAGE_PREFIX = 'enquiry_tracker_';

function getStorageItem<T>(key: string, defaultValue: T): T {
  const item = localStorage.getItem(STORAGE_PREFIX + key);
  if (!item) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

// APIs
export function getLocalCategories(): Category[] {
  return getStorageItem<Category[]>('categories', DEFAULT_CATEGORIES);
}

export function saveLocalCategory(name: string): Category {
  const categories = getLocalCategories();
  const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const newCat: Category = {
    id: 'cat-' + Math.random().toString(36).substr(2, 9),
    name
  };
  categories.push(newCat);
  setStorageItem('categories', categories);

  // Directly persist to Supabase DB
  if (isSupabaseConfigured() && supabase) {
    supabase.from('categories').insert([{ name }]).then(res => {
      if (res.error) console.warn('Supabase saveCategory sync error:', res.error);
    });
  }

  return newCat;
}

export function getLocalCourses(): Course[] {
  return getStorageItem<Course[]>('courses', DEFAULT_COURSES);
}

export function saveLocalCourse(courseData: Omit<Course, 'id' | 'created_at'> & { id?: string }): Course {
  const courses = getLocalCourses();
  
  if (courseData.id) {
    // Update
    const index = courses.findIndex(c => c.id === courseData.id);
    if (index !== -1) {
      courses[index] = {
        ...courses[index],
        ...courseData,
        id: courseData.id
      };
      setStorageItem('courses', courses);

      if (isSupabaseConfigured() && supabase) {
        supabase.from('courses').update({
          name: courseData.name,
          fee: courseData.fee,
          description: courseData.description,
          active: courseData.active,
          category_id: courseData.category_id
        }).eq('id', courseData.id).then();
      }

      return courses[index];
    }
  }

  // Create
  const newCourse: Course = {
    ...courseData,
    id: 'course-' + Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString()
  };
  courses.push(newCourse);
  setStorageItem('courses', courses);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('courses').insert([{
      name: courseData.name,
      fee: courseData.fee,
      description: courseData.description,
      active: courseData.active,
      category_id: courseData.category_id
    }]).then();
  }

  return newCourse;
}

export function deleteLocalCourse(id: string): void {
  const courses = getLocalCourses();
  const filtered = courses.filter(c => c.id !== id);
  setStorageItem('courses', filtered);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('courses').delete().eq('id', id).then();
  }
}

export function getLocalEnquiries(): Enquiry[] {
  const items = getStorageItem<Enquiry[]>('enquiries', DEFAULT_ENQUIRIES);
  if (items && items.length <= 2 && items.every(i => i.id === 'enq-1' || i.id === 'enq-2')) {
    setStorageItem('enquiries', DEFAULT_ENQUIRIES);
    return DEFAULT_ENQUIRIES;
  }
  return items;
}

export function addLocalEnquiry(enquiry: Omit<Enquiry, 'id' | 'created_at' | 'updated_at' | 'next_reminder_at' | 'last_reminded_at'>): Enquiry {
  const enquiries = getLocalEnquiries();
  const now = new Date();
  
  const nextReminder = new Date();
  nextReminder.setDate(now.getDate() + 2);

  const newEnq: Enquiry = {
    ...enquiry,
    id: 'enq-' + Math.random().toString(36).substr(2, 9),
    next_reminder_at: nextReminder.toISOString(),
    last_reminded_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  enquiries.unshift(newEnq);
  setStorageItem('enquiries', enquiries);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('enquiries').insert([{
      contact_name: enquiry.contact_name,
      contact_phone: enquiry.contact_phone,
      category_id: enquiry.category_id,
      course_id: enquiry.course_id,
      fee_shared: enquiry.fee_shared,
      payment: enquiry.payment || 'Pending',
      notes: enquiry.notes,
      interested: enquiry.interested,
      follow_up_done: enquiry.follow_up_done,
      can_follow_up: enquiry.can_follow_up,
      next_reminder_at: nextReminder.toISOString()
    }]).then(res => {
      if (res.error) console.warn('Supabase addEnquiry sync error:', res.error);
    });
  }

  return newEnq;
}

export function updateLocalEnquiry(id: string, updates: Partial<Enquiry>): Enquiry {
  const enquiries = getLocalEnquiries();
  const index = enquiries.findIndex(e => e.id === id);
  if (index === -1) {
    throw new Error(`Enquiry not found with ID: ${id}`);
  }

  const current = enquiries[index];
  const updated: Enquiry = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString()
  };

  enquiries[index] = updated;
  setStorageItem('enquiries', enquiries);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('enquiries').update(updates).eq('id', id).then(res => {
      if (res.error) console.warn('Supabase updateEnquiry sync error:', res.error);
    });
  }

  return updated;
}

export function deleteLocalEnquiry(id: string): void {
  const enquiries = getLocalEnquiries();
  const filtered = enquiries.filter(e => e.id !== id);
  setStorageItem('enquiries', filtered);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('enquiries').delete().eq('id', id).then(res => {
      if (res.error) console.warn('Supabase deleteEnquiry sync error:', res.error);
    });
  }
}

export function resetLocalDatabase(): void {
  localStorage.removeItem(STORAGE_PREFIX + 'categories');
  localStorage.removeItem(STORAGE_PREFIX + 'courses');
  localStorage.removeItem(STORAGE_PREFIX + 'enquiries');
  localStorage.removeItem(STORAGE_PREFIX + 'notes');
  localStorage.removeItem(STORAGE_PREFIX + 'sales_notes');
  localStorage.removeItem(STORAGE_PREFIX + 'admin_notes_v5');
  localStorage.removeItem(STORAGE_PREFIX + 'sales_notes_v5');
  localStorage.removeItem(STORAGE_PREFIX + 'admin_notes_v6');
  localStorage.removeItem(STORAGE_PREFIX + 'sales_notes_v6');
  localStorage.removeItem(STORAGE_PREFIX + 'admin_notes_v7');
  localStorage.removeItem(STORAGE_PREFIX + 'sales_notes_v7');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_admin_notes_initialized_v5');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_sales_notes_initialized_v5');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_admin_notes_initialized_v6');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_sales_notes_initialized_v6');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_admin_notes_initialized_v7');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_sales_notes_initialized_v7');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_notes_initialized_v2');
  localStorage.removeItem(STORAGE_PREFIX + 'todolist_sales_notes_initialized_v2');
}

// ----------------------------------------------------
// DEFAULT ADMIN NOTES (Strictly administrative & operational records)
// ----------------------------------------------------
export const DEFAULT_NOTES: Note[] = [
  {
    id: 'note-admin-1',
    content: 'Contacted municipal authority regarding annual campus fire safety and emergency compliance audit renewal.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    reminderDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_completed: false
  },
  {
    id: 'note-admin-2',
    content: 'Sent inquiry to facilities vendor for classroom projector upgrades and air-conditioning maintenance servicing.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    reminderDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_completed: false
  },
  {
    id: 'note-admin-3',
    content: 'Requested updated quotation from telecom provider for dedicated leased-line internet bandwidth upgrade.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    is_completed: false
  },
  {
    id: 'note-admin-4',
    content: 'Reviewing proposal for campus biometric security access system and cloud attendance software integration.',
    timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    reminderDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_completed: false
  },
  {
    id: 'note-admin-5',
    content: 'Evaluating vendor bids for cafeteria catering service contract and health inspection certification.',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    is_completed: false
  },
  {
    id: 'note-admin-6',
    content: 'Annual branch commercial property insurance policy successfully renewed and premium transaction finalized.',
    timestamp: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    action_item: 'Completed',
    role: 'admin',
    created_by: 'Admin',
    is_completed: true
  },
  {
    id: 'note-admin-7',
    content: 'Quarterly staff payroll reconciliation and statutory tax withholding compliance documentation approved.',
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    action_item: 'Completed',
    role: 'admin',
    created_by: 'Admin',
    is_completed: true
  },
  {
    id: 'note-admin-8',
    content: 'Follow-up with IT infrastructure team on Sunday server maintenance and offsite data backup log verification.',
    timestamp: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    reminderDate: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_completed: false
  },
  {
    id: 'note-admin-9',
    content: 'Meeting with external legal counsel regarding employee nondisclosure agreements and vendor terms update.',
    timestamp: new Date(Date.now() - 44 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    reminderDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_completed: false
  },
  {
    id: 'note-admin-10',
    content: 'Quarterly compliance filing documentation delivery due to regional education board office.',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    action_item: 'Pending',
    role: 'admin',
    created_by: 'Admin',
    reminderDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_completed: false
  }
];

// ----------------------------------------------------
// ----------------------------------------------------
// DEFAULT SALES NOTES (Client sales & counseling ledger)
// ----------------------------------------------------
export const DEFAULT_SALES_NOTES: Note[] = [
  {
    id: 'sales-note-20261014-14',
    content: 'Email Optimization & Verification: Tailored email pitches to address the specific technology needs of each school segment and ensured contact accuracy before dispatch.',
    role: 'sales',
    stage: 'Requirement-Based Email Sent',
    action_item: 'Requirement-Based Email Sent',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T17:30:00.000Z'
  },
  {
    id: 'sales-note-20261014-13',
    content: 'Madurai Outreach: Sent targeted cold outreach emails to 15 schools in Madurai, highlighting Admissions CRM and automated fee management solutions.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T17:00:00.000Z'
  },
  {
    id: 'sales-note-20261014-12',
    content: 'Chennai Outreach: Dispatched targeted cold outreach emails to 25 preschools in Chennai, focusing on website redesign and online enquiry tracking solutions.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T16:30:00.000Z'
  },
  {
    id: 'sales-note-20261014-11',
    content: 'Email List Validation: Completed pre-validation and deliverability verification of all 40 generated school email IDs to improve inbox deliverability.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T16:00:00.000Z'
  },
  {
    id: 'sales-note-20261014-10',
    content: 'School Data Research - Madurai: Generated targeted contact email lists for 15 target schools across Madurai using AI-powered search tools.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T15:30:00.000Z'
  },
  {
    id: 'sales-note-20261014-09',
    content: 'School Data Research - Chennai: Generated targeted contact email lists for 25 target schools across Chennai using AI-powered search tools.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T15:00:00.000Z'
  },
  {
    id: 'sales-note-20261014-08',
    content: 'ACME Global Outreach: Sent a partnership and business opportunity email to ACME Global, as advised by Arun.',
    role: 'sales',
    stage: 'Proposal',
    action_item: 'Proposal',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T14:30:00.000Z'
  },
  {
    id: 'sales-note-20261014-07',
    content: 'Facebook Community Engagement: Published promotional posts and joined relevant active business networking groups.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T14:00:00.000Z'
  },
  {
    id: 'sales-note-20261014-06',
    content: 'Facebook Business Setup: Created the company\'s Facebook business page and updated the official profile.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T12:30:00.000Z'
  },
  {
    id: 'sales-note-20261014-05',
    content: 'Team Coordination: Discussed outreach activities with Hamsalekha and assigned the day\'s outreach tasks.',
    role: 'sales',
    stage: 'Requirement Gathering',
    action_item: 'Requirement Gathering',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T12:00:00.000Z'
  },
  {
    id: 'sales-note-20261014-04',
    content: 'Business Development: Searched LinkedIn for additional business opportunities and established new professional connections.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T11:15:00.000Z'
  },
  {
    id: 'sales-note-20261014-03',
    content: 'Website Development Leads: Sent response emails for website development opportunities identified on LinkedIn.',
    role: 'sales',
    stage: 'Estimation',
    action_item: 'Estimation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T10:30:00.000Z'
  },
  {
    id: 'sales-note-20261014-02',
    content: 'Upwork Verification: Discussed and clarified Upwork membership verification requirements with the team.',
    role: 'sales',
    stage: 'Requirement Gathering',
    action_item: 'Requirement Gathering',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T10:00:00.000Z'
  },
  {
    id: 'sales-note-20261014-01',
    content: 'LinkedIn Partnerships: Sent 2 partnership proposal emails to companies identified through LinkedIn.',
    role: 'sales',
    stage: 'Proposal',
    action_item: 'Proposal',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-14',
    timestamp: '2026-10-14T09:30:00.000Z'
  },
  {
    id: 'sales-note-1',
    content: 'Researching Linkedin and getting connects and looking for leads. Have showed interest for one job post and replied with our portfolio.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-13',
    timestamp: '2026-10-13T10:00:00.000Z'
  },
  {
    id: 'sales-note-2',
    content: 'Profile update in Upwork. Have clarified the issue with suspension is under review as the verification process takes time.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-13',
    timestamp: '2026-10-13T09:30:00.000Z'
  },
  {
    id: 'sales-note-3',
    content: 'Handling Upwork account issue',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: undefined,
    timestamp: '2026-10-13T09:00:00.000Z'
  },
  {
    id: 'sales-note-4',
    content: 'Making Bids in Freelancer for the posted opprtnities.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: undefined,
    timestamp: '2026-10-13T08:30:00.000Z'
  },
  {
    id: 'sales-note-5',
    content: 'Priority mails for 15 companies (provided by Ganesh Senthil) has been sent.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-13',
    timestamp: '2026-10-13T07:30:00.000Z'
  },
  {
    id: 'sales-note-6',
    content: 'Have made a bid in Freelancer.in for website development project.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-13',
    timestamp: '2026-10-12T16:00:00.000Z'
  },
  {
    id: 'sales-note-7',
    content: 'Created a profile in Freelancer site as suggested by Hamsalekha.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: undefined,
    timestamp: '2026-10-12T14:30:00.000Z'
  },
  {
    id: 'sales-note-8',
    content: 'KT and Task assigned to Hamsalekha.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: undefined,
    timestamp: '2026-10-12T12:00:00.000Z'
  },
  {
    id: 'sales-note-9',
    content: 'Had a Team meeting this morning and discussed the pipeline and action needed items.',
    role: 'sales',
    stage: 'Requirement Gathering',
    action_item: 'Requirement Gathering',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: undefined,
    timestamp: '2026-10-12T10:00:00.000Z'
  },
  {
    id: 'sales-note-10',
    content: 'Contacted Saranya -Event Management client with Website requirement. She will be calling back in few minutes.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: undefined,
    timestamp: '2026-10-12T09:30:00.000Z'
  },
  {
    id: 'sales-note-11',
    content: 'Confirmed a final Quote for NIVI on added feature. Have scheduled a call in 30 mins.',
    role: 'sales',
    stage: 'Estimation',
    action_item: 'Estimation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-12',
    timestamp: '2026-10-12T09:00:00.000Z'
  },
  {
    id: 'sales-note-12',
    content: "Following up NIVI for additional features request and clarifying their exact needs to asses if it's in scope.",
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-10',
    timestamp: '2026-10-10T11:15:00.000Z'
  },
  {
    id: 'sales-note-13',
    content: "Successfully completed outreach for GMT's key digital products — Security Services, Boutique Business, and Sports Academy solutions — reaching out to 40 prospective contacts to generate leads, build awareness, and explore potential business opportunities. WhatsApp messages to 24 contacts were done as well.",
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-09',
    timestamp: '2026-10-09T16:45:00.000Z'
  },
  {
    id: 'sales-note-14',
    content: 'Called Khaleel - Madurai Department store owner for meeting up tomorrow for Sales pitch. Going along with Shanthini. Client has asked to confirm tomorrow morning.',
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-10',
    timestamp: '2026-10-09T14:20:00.000Z'
  },
  {
    id: 'sales-note-15',
    content: "Called and cancelled today's interview for the 2 prospects.",
    role: 'sales',
    stage: 'Lead Generation',
    action_item: 'Lead Generation',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-09',
    timestamp: '2026-10-09T10:00:00.000Z'
  },
  {
    id: 'sales-note-16',
    content: 'Contacted 25 client prospects through mail and Whatsapp messages.',
    role: 'sales',
    stage: 'Proposal',
    action_item: 'Proposal',
    is_completed: false,
    created_by: 'Sales Desk',
    reminderDate: '2026-10-06',
    timestamp: '2026-10-06T12:00:00.000Z'
  }
];

const ADMIN_NOTES_STORAGE_KEY = 'admin_notes_v11';
const SALES_NOTES_STORAGE_KEY = 'sales_notes_v11';
const ADMIN_NOTES_INITIALIZED_KEY = 'todolist_admin_notes_initialized_v11';
const SALES_NOTES_INITIALIZED_KEY = 'todolist_sales_notes_initialized_v11';

export function syncLocalSalesNotes(notes: Note[]): void {
  if (notes && notes.length > 0) {
    // Filter out any fake seeded sales-note-today items and normalize each note
    const cleanIncoming = notes
      .filter(n => !String(n.id).startsWith('sales-note-today-'))
      .map(normalizeSalesNote);
    
    // Preserve any legitimately added local sales notes that haven't yet reached Supabase
    const currentLocal = getStorageItem<Note[]>(SALES_NOTES_STORAGE_KEY, [])
      || getStorageItem<Note[]>('sales_notes_v10', [])
      || getStorageItem<Note[]>('sales_notes', []);
    const cleanLocal = (currentLocal || [])
      .filter(n => !String(n.id).startsWith('sales-note-today-'))
      .map(normalizeSalesNote);
    
    const incomingIds = new Set(cleanIncoming.map(n => String(n.id)));
    const localPending = cleanLocal.filter(n => !incomingIds.has(String(n.id)));
    const merged = [...cleanIncoming, ...localPending];

    // Strict deduplication strictly by ID only — NEVER delete or drop user notes based on content
    const seenIds = new Set<string>();
    const deduplicated: Note[] = [];

    for (const item of merged) {
      const idStr = String(item.id);
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);
      deduplicated.push(item);
    }

    setStorageItem(SALES_NOTES_STORAGE_KEY, deduplicated);
    setStorageItem(SALES_NOTES_INITIALIZED_KEY, true);
  }
}

export function syncLocalAdminNotes(notes: Note[]): void {
  if (notes && notes.length > 0) {
    setStorageItem(ADMIN_NOTES_STORAGE_KEY, notes);
    setStorageItem(ADMIN_NOTES_INITIALIZED_KEY, true);
  }
}

export function getLocalNotes(role?: 'admin' | 'sales' | string): Note[] {
  const currentRole = role || getCurrentUserSession()?.role || 'admin';
  const isSales = currentRole === 'sales';

  if (isSales) {
    const isSalesInitialized = getStorageItem<boolean>(SALES_NOTES_INITIALIZED_KEY, false);
    if (!isSalesInitialized) {
      // Check if user has notes in any previous storage key (v10, v9, etc.) to ensure NO existing notes are lost
      const previousNotes = getStorageItem<Note[]>('sales_notes_v10', [])
        || getStorageItem<Note[]>('sales_notes_v9', [])
        || getStorageItem<Note[]>('sales_notes', []);
      
      const seedToUse = (previousNotes && previousNotes.length > 0) ? previousNotes.map(normalizeSalesNote) : DEFAULT_SALES_NOTES.map(normalizeSalesNote);
      setStorageItem(SALES_NOTES_STORAGE_KEY, seedToUse);
      setStorageItem(SALES_NOTES_INITIALIZED_KEY, true);
      return seedToUse;
    }
    const salesNotes = getStorageItem<Note[]>(SALES_NOTES_STORAGE_KEY, DEFAULT_SALES_NOTES);
    const validRawNotes = (salesNotes && salesNotes.length > 0) ? salesNotes : DEFAULT_SALES_NOTES;
    
    // Always strip out any fake sales-note-today-* items, but never mutate or modify user note content or stage
    const filtered = validRawNotes
      .filter(n => 
        !String(n.id).startsWith('sales-note-today-') &&
        n.role !== 'admin' && 
        n.created_by !== 'Admin' && 
        (n.role === 'sales' || n.created_by === 'Sales Desk' || String(n.id).startsWith('sales-note-'))
      );

    // Strict deduplication by ID only — NO notes are deleted or dropped
    const seenIds = new Set<string>();
    const deduplicated: Note[] = [];

    for (const item of filtered) {
      const idStr = String(item.id);
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);
      deduplicated.push(normalizeSalesNote(item));
    }

    if (deduplicated.length !== validRawNotes.length) {
      setStorageItem(SALES_NOTES_STORAGE_KEY, deduplicated);
    }

    if (deduplicated.length === 0) {
      const seeded = DEFAULT_SALES_NOTES.map(normalizeSalesNote);
      setStorageItem(SALES_NOTES_STORAGE_KEY, seeded);
      return seeded;
    }
    return deduplicated;
  }

  // Admin notes logic - strictly Admin only (NO sales notes or sales stages)
  const isInitialized = getStorageItem<boolean>(ADMIN_NOTES_INITIALIZED_KEY, false);
  if (!isInitialized) {
    setStorageItem(ADMIN_NOTES_STORAGE_KEY, DEFAULT_NOTES);
    setStorageItem(ADMIN_NOTES_INITIALIZED_KEY, true);
    return DEFAULT_NOTES;
  }
  const notes = getStorageItem<Note[]>(ADMIN_NOTES_STORAGE_KEY, DEFAULT_NOTES);
  const validAdminNotes = (notes && notes.length > 0) ? notes : DEFAULT_NOTES;
  const filteredAdmin = validAdminNotes
    .filter(n => n.role !== 'sales' && !String(n.id).startsWith('sales-note-') && n.created_by !== 'Sales Desk')
    .map(n => {
      const isCompleted = Boolean(n.is_completed || n.action_item === 'Completed');
      return {
        ...n,
        role: 'admin' as const,
        created_by: 'Admin',
        is_completed: isCompleted,
        action_item: isCompleted ? 'Completed' : 'Pending',
        stage: undefined
      };
    });

  if (filteredAdmin.length === 0) {
    setStorageItem(ADMIN_NOTES_STORAGE_KEY, DEFAULT_NOTES);
    return DEFAULT_NOTES;
  }
  return filteredAdmin;
}

export function saveLocalNote(note: Omit<Note, 'id' | 'timestamp'> & { id?: string; timestamp?: string }, role?: 'admin' | 'sales' | string): Note {
  const targetRole = role || note.role || getCurrentUserSession()?.role || 'admin';
  const isSales = targetRole === 'sales';

  if (isSales) {
    const hasCategory = Boolean(note.category && note.category !== 'null' && note.category !== 'None' && String(note.category).trim() !== '');
    const hasStage = Boolean(note.stage && note.stage !== 'null' && note.stage !== 'None' && String(note.stage).trim() !== '');

    const finalStage = hasStage ? note.stage : undefined;
    const finalCategory = hasCategory ? note.category : undefined;
    const finalActionItem = finalCategory ? `Workstream: ${finalCategory}` : (finalStage || undefined);

    const noteId = note.id || ('sales-note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));
    const noteTimestamp = note.timestamp || new Date().toISOString();
    const newNote: Note = {
      ...note,
      role: 'sales',
      created_by: note.created_by || 'Sales Desk',
      stage: finalStage,
      category: finalCategory,
      action_item: finalActionItem,
      is_completed: finalStage === 'Customer Onboarding' || finalStage === 'Converted' || finalStage === 'Partnership Followup',
      id: noteId,
      timestamp: noteTimestamp
    };

    // Filter out both matching ID and matching content so it is never saved twice
    const contentKey = newNote.content.trim().toLowerCase();
    const salesNotes = getLocalNotes('sales').filter(n => 
      n.id !== noteId && 
      !String(n.id).startsWith('sales-note-today-') &&
      n.content.trim().toLowerCase() !== contentKey
    );
    const updatedSalesNotes = [newNote, ...salesNotes];
    setStorageItem(SALES_NOTES_STORAGE_KEY, updatedSalesNotes);
    setStorageItem(SALES_NOTES_INITIALIZED_KEY, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sales-notes-updated'));
    }

    if (isSupabaseConfigured() && supabase) {
      supabase.from('notes').upsert([{
        id: newNote.id,
        content: newNote.content,
        role: 'sales',
        stage: newNote.stage || null,
        action_item: newNote.action_item || null,
        is_completed: newNote.is_completed || false,
        created_by: newNote.created_by,
        reminderDate: newNote.reminderDate || null,
        timestamp: newNote.timestamp
      }]).then(res => {
        if (res.error) console.warn('Supabase saveSalesNote sync error:', res.error);
      });
    }

    return newNote;
  } else {
    const isCompleted = Boolean(note.is_completed || note.action_item === 'Completed');
    const newNote: Note = {
      ...note,
      role: 'admin',
      created_by: 'Admin',
      stage: undefined,
      action_item: isCompleted ? 'Completed' : 'Pending',
      is_completed: isCompleted,
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      timestamp: new Date().toISOString()
    };
    const adminNotes = getLocalNotes('admin');
    const updatedAdminNotes = [newNote, ...adminNotes];
    setStorageItem(ADMIN_NOTES_STORAGE_KEY, updatedAdminNotes);
    setStorageItem(ADMIN_NOTES_INITIALIZED_KEY, true);

    if (isSupabaseConfigured() && supabase) {
      supabase.from('notes').insert([{
        id: newNote.id,
        content: newNote.content,
        role: 'admin',
        stage: null,
        action_item: newNote.action_item,
        is_completed: newNote.is_completed,
        created_by: newNote.created_by,
        reminderDate: newNote.reminderDate || null,
        timestamp: newNote.timestamp
      }]).then(res => {
        if (res.error) console.warn('Supabase saveAdminNote sync error:', res.error);
      });
    }

    return newNote;
  }
}

export function updateLocalNote(id: string, updates: Partial<Note>, role?: 'admin' | 'sales' | string): Note {
  const isSalesId = String(id).startsWith('sales-note-');
  const targetRole = role || (isSalesId ? 'sales' : (getCurrentUserSession()?.role || 'admin'));
  const isSales = targetRole === 'sales' || isSalesId;

  if (isSales) {
    const salesNotes = getLocalNotes('sales');
    const index = salesNotes.findIndex(n => String(n.id) === String(id));
    if (index !== -1) {
      const current = salesNotes[index];

      let finalStage = current.stage;
      if (updates.stage !== undefined) {
        finalStage = (updates.stage && updates.stage !== 'null' && updates.stage !== 'None' && String(updates.stage).trim() !== '') ? updates.stage : undefined;
      }

      let finalCategory = current.category;
      if (updates.category !== undefined) {
        finalCategory = (updates.category && updates.category !== 'null' && updates.category !== 'None' && String(updates.category).trim() !== '') ? updates.category : undefined;
      }

      const finalActionItem = finalCategory ? `Workstream: ${finalCategory}` : (finalStage || undefined);

      const updated: Note = {
        ...current,
        ...updates,
        role: 'sales',
        stage: finalStage,
        category: finalCategory,
        action_item: finalActionItem,
        is_completed: finalStage === 'Customer Onboarding' || finalStage === 'Converted' || finalStage === 'Partnership Followup' || (updates.is_completed !== undefined ? updates.is_completed : current.is_completed)
      };
      salesNotes[index] = updated;
      setStorageItem(SALES_NOTES_STORAGE_KEY, salesNotes);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sales-notes-updated'));
      }

      if (isSupabaseConfigured() && supabase) {
        supabase.from('notes').update({
          content: updated.content,
          stage: updated.stage || null,
          action_item: updated.action_item || null,
          reminderDate: updated.reminderDate || null,
          is_completed: updated.is_completed || false
        }).eq('id', id).then(res => {
          if (res.error) console.warn('Supabase updateLocalNote sync error:', res.error);
        });
      }

      return updated;
    }
  } else {
    const adminNotes = getLocalNotes('admin');
    const index = adminNotes.findIndex(n => String(n.id) === String(id));
    if (index !== -1) {
      const current = adminNotes[index];
      const isCompleted = updates.is_completed !== undefined 
        ? updates.is_completed 
        : (updates.action_item ? updates.action_item === 'Completed' : current.is_completed);
      const updated: Note = {
        ...current,
        ...updates,
        role: 'admin',
        created_by: 'Admin',
        is_completed: isCompleted,
        action_item: isCompleted ? 'Completed' : 'Pending',
        stage: undefined
      };
      adminNotes[index] = updated;
      setStorageItem(ADMIN_NOTES_STORAGE_KEY, adminNotes);

      if (isSupabaseConfigured() && supabase) {
        supabase.from('notes').update({
          content: updated.content,
          action_item: updated.action_item,
          is_completed: updated.is_completed,
          reminderDate: updated.reminderDate || null
        }).eq('id', id).then();
      }

      return updated;
    }
  }

  console.warn(`Note not found with ID: ${id}`);
  return { id, ...updates } as Note;
}

export function deleteLocalNote(id: string, role?: 'admin' | 'sales' | string): void {
  const isSalesId = String(id).startsWith('sales-note-');
  const targetRole = role || (isSalesId ? 'sales' : (getCurrentUserSession()?.role || 'admin'));

  if (targetRole === 'sales' || isSalesId) {
    const salesNotes = getStorageItem<Note[]>(SALES_NOTES_STORAGE_KEY, []);
    const filtered = salesNotes.filter(n => String(n.id) !== String(id));
    setStorageItem(SALES_NOTES_STORAGE_KEY, filtered);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sales-notes-updated'));
    }
  } else {
    const adminNotes = getStorageItem<Note[]>(ADMIN_NOTES_STORAGE_KEY, []);
    const filtered = adminNotes.filter(n => String(n.id) !== String(id));
    setStorageItem(ADMIN_NOTES_STORAGE_KEY, filtered);
  }

  if (isSupabaseConfigured() && supabase) {
    supabase.from('notes').delete().eq('id', id).then();
  }
}

// ==========================================
// EMPLOYEES
// ==========================================

// Default Seed Employees
export const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'emp-sneha',
    name: 'Sneha',
    username: 'sneha',
    password: 'password123',
    role: 'Frontend & Full Stack Developer',
    contact_number: '+91 98765 12345',
    email: 'sneha@globalminds.com',
    address: 'OMR, Chennai, Tamil Nadu',
    age: '24',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'emp-rahul',
    name: 'Rahul Sharma',
    username: 'rahul',
    password: 'password123',
    role: 'Lead Academic Counselor',
    contact_number: '+91 98765 67890',
    email: 'rahul@globalminds.com',
    address: 'HSR Layout, Bangalore, Karnataka',
    age: '28',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export function getLocalEmployees(): Employee[] {
  const employees = getStorageItem<Employee[]>('employees', []);
  if (!employees || employees.length === 0) {
    setStorageItem('employees', DEFAULT_EMPLOYEES);
    return DEFAULT_EMPLOYEES;
  }
  // Ensure sneha and default accounts exist if someone clears or has custom list without sneha
  const hasSneha = employees.some(e => e.username?.toLowerCase() === 'sneha' || e.name.toLowerCase() === 'sneha');
  if (!hasSneha) {
    const updated = [DEFAULT_EMPLOYEES[0], ...employees];
    setStorageItem('employees', updated);
    return updated;
  }
  return employees;
}

export function saveLocalEmployee(employee: Omit<Employee, 'id'>): Employee {
  const cleanEmail = (employee.email || '').trim().toLowerCase();
  const cleanName = (employee.name || '').trim().toLowerCase();
  const cleanUsername = (employee.username || '').trim().toLowerCase();
  if (
    cleanEmail === 'admin' ||
    cleanEmail === 'admin@globalminds.com' ||
    cleanEmail.startsWith('admin@') ||
    cleanUsername === 'admin' ||
    cleanName === 'admin' ||
    cleanName === 'administrator' ||
    cleanEmail === 'sales' ||
    cleanEmail === 'sales@globalminds.com' ||
    cleanUsername === 'sales' ||
    cleanName === 'sales'
  ) {
    throw new Error('Admin or Sales accounts cannot be created here. They use standard pre-configured credentials.');
  }

  const employees = getLocalEmployees();
  const newEmployee: Employee = {
    ...employee,
    id: 'emp-' + Math.random().toString(36).substr(2, 9),
    created_at: employee.created_at || new Date().toISOString()
  };
  employees.unshift(newEmployee);
  setStorageItem('employees', employees);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employees').insert([{
      name: newEmployee.name,
      username: newEmployee.username,
      email: newEmployee.email,
      contact_number: newEmployee.contact_number,
      role: newEmployee.role || 'Employee',
      age: newEmployee.age,
      address: newEmployee.address,
      aadhar_number: newEmployee.aadhar_number,
      pan_number: newEmployee.pan_number,
      aadhar_doc_url: newEmployee.aadhar_doc_url,
      pan_doc_url: newEmployee.pan_doc_url
    }]).then(res => {
      if (res.error) console.warn('Supabase saveEmployee sync error:', res.error);
    });
  }

  return newEmployee;
}

export function updateLocalEmployee(id: string, updates: Partial<Employee>): Employee {
  const employees = getLocalEmployees();
  const index = employees.findIndex(e => e.id === id);
  if (index === -1) {
    throw new Error(`Employee not found with ID: ${id}`);
  }

  const current = employees[index];
  const updated: Employee = {
    ...current,
    ...updates,
  };

  employees[index] = updated;
  setStorageItem('employees', employees);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employees').update(updates).eq('id', id).then(res => {
      if (res.error) console.warn('Supabase updateEmployee sync error:', res.error);
    });
  }

  return updated;
}

export function deleteLocalEmployee(id: string): void {
  const employees = getLocalEmployees();
  const filtered = employees.filter(e => e.id !== id);
  setStorageItem('employees', filtered);

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employees').delete().eq('id', id).then(res => {
      if (res.error) console.warn('Supabase deleteEmployee sync error:', res.error);
    });
  }
}

// Employee Credentials Store (for locally storing / caching employee portal passwords)
export function decodeStoredPassword(encoded?: string | null): string | null {
  if (!encoded || typeof encoded !== 'string') return null;
  if (!encoded.startsWith('AUTH_KEY:')) return null;
  try {
    const raw = encoded.substring('AUTH_KEY:'.length);
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return decodeURIComponent(escape(window.atob(raw)));
    }
    if (typeof atob === 'function') {
      return atob(raw);
    }
    return raw;
  } catch {
    return null;
  }
}

export function encodeStoredPassword(pass: string): string {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return `AUTH_KEY:${window.btoa(unescape(encodeURIComponent(pass)))}`;
    }
    if (typeof btoa === 'function') {
      return `AUTH_KEY:${btoa(pass)}`;
    }
    return `AUTH_KEY:${pass}`;
  } catch {
    return `AUTH_KEY:${pass}`;
  }
}

export function getEmployeeCredentials(): Record<string, string> {
  try {
    const raw = localStorage.getItem('employee_credentials');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveEmployeeCredential(identifier: string, password: string): void {
  if (!identifier || !password) return;
  const creds = getEmployeeCredentials();
  const cleanKey = identifier.trim().toLowerCase();
  creds[cleanKey] = password;
  localStorage.setItem('employee_credentials', JSON.stringify(creds));
}

export async function persistEmployeePassword(empIdOrEmail: string, password: string): Promise<void> {
  if (!empIdOrEmail || !password) return;
  saveEmployeeCredential(empIdOrEmail, password);

  if (isSupabaseConfigured() && supabase) {
    try {
      const enc = encodeStoredPassword(password);
      const cleanKey = empIdOrEmail.toLowerCase().trim();
      if (cleanKey.includes('@')) {
        await supabase.from('employees').update({ pan_doc_name: enc }).eq('email', cleanKey);
      } else {
        await supabase.from('employees').update({ pan_doc_name: enc }).eq('id', empIdOrEmail);
      }
    } catch (err) {
      console.warn('Could not persist employee password to Supabase:', err);
    }
  }
}

export function getEmployeePassword(emp: Employee): string {
  if (emp.password) return emp.password;
  const decoded = decodeStoredPassword((emp as any).pan_doc_name);
  if (decoded) return decoded;
  const creds = getEmployeeCredentials();
  if (emp.id && creds[emp.id.toLowerCase()]) return creds[emp.id.toLowerCase()];
  if (emp.email && creds[emp.email.toLowerCase()]) return creds[emp.email.toLowerCase()];
  if (emp.username && creds[emp.username.toLowerCase()]) return creds[emp.username.toLowerCase()];
  if (emp.name && creds[emp.name.toLowerCase()]) return creds[emp.name.toLowerCase()];
  return 'password123';
}

// Sync employees fetched from Supabase with local storage cache
export function syncEmployeesWithSupabase(supabaseEmployees: Employee[]): Employee[] {
  if (!Array.isArray(supabaseEmployees)) return getLocalEmployees();

  const local = getLocalEmployees();
  const localMap = new Map<string, Employee>();

  // Add all local employees to map
  for (const emp of local) {
    if (emp.id) localMap.set(emp.id, emp);
    if (emp.email) localMap.set(emp.email.toLowerCase(), emp);
  }

  // Merge Supabase employees
  for (const sEmp of supabaseEmployees) {
    const existing = localMap.get(sEmp.id) || (sEmp.email ? localMap.get(sEmp.email.toLowerCase()) : undefined);
    const decodedRemote = decodeStoredPassword((sEmp as any).pan_doc_name);
    const resolvedPassword = decodedRemote || existing?.password || getEmployeePassword(sEmp);

    const merged: Employee = {
      ...existing,
      ...sEmp,
      email: sEmp.email || existing?.email,
      username: sEmp.username || existing?.username || (sEmp.email ? sEmp.email.split('@')[0] : sEmp.name.toLowerCase().replace(/\s+/g, '')),
      password: resolvedPassword
    };
    localMap.set(sEmp.id, merged);
    if (merged.email) {
      localMap.set(merged.email.toLowerCase(), merged);
    }
    if (merged.email && resolvedPassword) {
      saveEmployeeCredential(merged.email, resolvedPassword);
    }
  }

  // Deduplicate by ID
  const deduped: Employee[] = [];
  const seenIds = new Set<string>();
  for (const emp of localMap.values()) {
    if (emp.id && !seenIds.has(emp.id)) {
      seenIds.add(emp.id);
      deduped.push(emp);
    }
  }

  setStorageItem('employees', deduped);
  return deduped;
}

// Universal employee account finder: checks Supabase first (if online), then local cache
export async function findEmployeeAccount(searchKey: string): Promise<Employee | null> {
  const cleanKey = searchKey.trim().toLowerCase();
  if (!cleanKey) return null;

  // 1. Try checking Supabase employees table
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*');

      if (!error && data && data.length > 0) {
        // Sync these to local cache immediately
        syncEmployeesWithSupabase(data as Employee[]);

        const found = (data as Employee[]).find(e => {
          const email = (e.email || '').trim().toLowerCase();
          const name = (e.name || '').trim().toLowerCase();
          const username = email ? email.split('@')[0] : name.replace(/\s+/g, '');
          return email === cleanKey || name === cleanKey || username === cleanKey;
        });

        if (found) {
          const creds = getEmployeeCredentials();
          const decodedRemote = decodeStoredPassword((found as any).pan_doc_name);
          const customPass = decodedRemote ||
                             (found.id && creds[found.id.toLowerCase()]) || 
                             (found.email && creds[found.email.toLowerCase()]) || 
                             'password123';

          // Cache locally
          if (found.email && customPass) saveEmployeeCredential(found.email, customPass);
          if (found.id && customPass) saveEmployeeCredential(found.id, customPass);

          return {
            ...found,
            username: found.email ? found.email.split('@')[0] : found.name.toLowerCase().replace(/\s+/g, ''),
            password: found.password || customPass
          };
        }
      }
    } catch (err) {
      console.warn('Supabase findEmployeeAccount fallback to local:', err);
    }
  }

  // 2. Check local database
  const localList = getLocalEmployees();
  const localMatch = localList.find(e => {
    const email = (e.email || '').trim().toLowerCase();
    const name = (e.name || '').trim().toLowerCase();
    const username = (e.username || '').trim().toLowerCase();
    return email === cleanKey || name === cleanKey || username === cleanKey;
  });

  if (localMatch) {
    return {
      ...localMatch,
      password: getEmployeePassword(localMatch)
    };
  }

  return null;
}

export async function resetEmployeePassword(identifier: string, newPass: string): Promise<Employee | null> {
  const emp = await findEmployeeAccount(identifier);
  if (!emp) return null;
  emp.password = newPass;
  await persistEmployeePassword(emp.email || emp.id, newPass);
  if (emp.id) saveEmployeeCredential(emp.id, newPass);
  if (emp.email) saveEmployeeCredential(emp.email, newPass);
  if (emp.username) saveEmployeeCredential(emp.username, newPass);
  
  try {
    updateLocalEmployee(emp.id, { password: newPass });
  } catch {
    // If not in local array, ignore
  }
  return emp;
}

// --- Default Employee Tasks ---
export const DEFAULT_EMPLOYEE_TASKS: EmployeeTask[] = [
  {
    id: 'task-sneha-1',
    employee_id: 'emp-sneha',
    title: 'Complete Lead tracker payment dropdown and note action items',
    description: 'Updated fee shared label to details shared, added payment dropdown, and placed action items column directly next to note content.',
    priority: 'High',
    status: 'Completed',
    due_date: new Date().toISOString().split('T')[0],
    assigned_by: 'Admin',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'task-sneha-2',
    employee_id: 'emp-sneha',
    title: 'Develop Employee portal and daily reporting module',
    description: 'Build role-based employee login, task isolation view, and long-term daily report submission and historical archive.',
    priority: 'High',
    status: 'In Progress',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_by: 'Admin',
    created_at: new Date().toISOString()
  },
  {
    id: 'task-sneha-3',
    employee_id: 'emp-sneha',
    title: 'Perform cross-browser responsiveness audit on mobile tablets',
    description: 'Verify navigation drawers, tables, and voice note microphone inputs on iPad and Android screen sizes.',
    priority: 'Medium',
    status: 'Pending',
    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_by: 'Admin',
    created_at: new Date().toISOString()
  },
  {
    id: 'task-rahul-1',
    employee_id: 'emp-rahul',
    title: 'Follow up with 5 prospective NEET & JEE counseling enquiries',
    description: 'Schedule demo counseling sessions and outline course fee breakdown.',
    priority: 'Medium',
    status: 'In Progress',
    due_date: new Date().toISOString().split('T')[0],
    assigned_by: 'Admin',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

// --- Employee Tasks Data ---
export const getLocalEmployeeTasks = (): EmployeeTask[] => {
  try {
    const data = localStorage.getItem('local_employee_tasks');
    if (!data) {
      localStorage.setItem('local_employee_tasks', JSON.stringify(DEFAULT_EMPLOYEE_TASKS));
      return DEFAULT_EMPLOYEE_TASKS;
    }
    const parsed: EmployeeTask[] = JSON.parse(data);
    if (!parsed || parsed.length === 0) {
      localStorage.setItem('local_employee_tasks', JSON.stringify(DEFAULT_EMPLOYEE_TASKS));
      return DEFAULT_EMPLOYEE_TASKS;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading local tasks:', error);
    return DEFAULT_EMPLOYEE_TASKS;
  }
};

export const saveLocalEmployeeTask = (task: Omit<EmployeeTask, 'id' | 'created_at'>): EmployeeTask => {
  const tasks = getLocalEmployeeTasks();
  const newTask: EmployeeTask = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    created_at: new Date().toISOString()
  };
  
  tasks.unshift(newTask);
  localStorage.setItem('local_employee_tasks', JSON.stringify(tasks));

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employee_tasks').insert([{
      employee_id: task.employee_id,
      title: task.title,
      description: task.description || null,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      assigned_by: task.assigned_by || 'Admin'
    }]).then(res => {
      if (res.error) console.warn('Supabase saveTask sync error:', res.error);
    });
  }

  return newTask;
};

export const updateLocalEmployeeTask = (id: string, updates: Partial<EmployeeTask>): EmployeeTask | null => {
  const tasks = getLocalEmployeeTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    localStorage.setItem('local_employee_tasks', JSON.stringify(tasks));

    if (isSupabaseConfigured() && supabase) {
      supabase.from('employee_tasks').update(updates).eq('id', id).then();
    }

    return tasks[index];
  }
  return null;
};

export const deleteLocalEmployeeTask = (id: string): void => {
  const tasks = getLocalEmployeeTasks();
  const filtered = tasks.filter(t => t.id !== id);
  localStorage.setItem('local_employee_tasks', JSON.stringify(filtered));

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employee_tasks').delete().eq('id', id).then();
  }
};

// ==========================================
// EMPLOYEE DAILY REPORTS (Long-Term Archive)
// ==========================================

const DEFAULT_DAILY_REPORTS: EmployeeDailyReport[] = [
  {
    id: 'report-sneha-1',
    employee_id: 'emp-sneha',
    employee_name: 'Sneha',
    report_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    today_updates: '1. Upgraded Fee Shared column into Details Shared across all lead trackers.\n2. Implemented Payment dropdown with values (Partially Paid, Pending, Completed).\n3. Handled Supabase column fallback for seamless schema compatibility.',
    challenges_blockers: 'None. All automated unit validations and TypeScript builds passed.',
    plan_for_tomorrow: 'Position Action Item column in Notes table and begin Employee portal architecture.',
    hours_worked: 8,
    status: 'Reviewed',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'report-sneha-2',
    employee_id: 'emp-sneha',
    employee_name: 'Sneha',
    report_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    today_updates: '1. Built Recent Notes pagination and row-per-page selector.\n2. Tested speech-to-text voice notes microphone recording.\n3. Verified student tuition conversion calculations in Conversion module.',
    challenges_blockers: 'Browser Web Speech API permissions required initial user gesture.',
    plan_for_tomorrow: 'Enhance lead status alerts and follow-up reminders.',
    hours_worked: 7.5,
    status: 'Reviewed',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const getLocalDailyReports = (): EmployeeDailyReport[] => {
  try {
    const rawDeleted = localStorage.getItem('deleted_daily_report_ids');
    const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];

    const data = localStorage.getItem('local_employee_daily_reports');
    if (!data) {
      const initial = DEFAULT_DAILY_REPORTS.filter(r => !deletedIds.includes(String(r.id)));
      localStorage.setItem('local_employee_daily_reports', JSON.stringify(initial));
      return initial;
    }
    const parsed: EmployeeDailyReport[] = JSON.parse(data);
    return parsed.filter(r => !deletedIds.includes(String(r.id)));
  } catch (error) {
    console.error('Error reading local daily reports:', error);
    return DEFAULT_DAILY_REPORTS;
  }
};

export const saveLocalDailyReport = (report: Omit<EmployeeDailyReport, 'id' | 'created_at'>): EmployeeDailyReport => {
  const reports = getLocalDailyReports();
  // Check if report for this employee on this date already exists
  const existingIndex = reports.findIndex(
    r => r.employee_id === report.employee_id && r.report_date === report.report_date
  );

  let resultReport: EmployeeDailyReport;

  if (existingIndex !== -1) {
    // Update existing report for today
    const updated: EmployeeDailyReport = {
      ...reports[existingIndex],
      ...report,
      updated_at: new Date().toISOString()
    };
    reports[existingIndex] = updated;
    localStorage.setItem('local_employee_daily_reports', JSON.stringify(reports));
    resultReport = updated;
  } else {
    const newReport: EmployeeDailyReport = {
      ...report,
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    reports.unshift(newReport);
    localStorage.setItem('local_employee_daily_reports', JSON.stringify(reports));
    resultReport = newReport;
  }

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employee_daily_reports').upsert([{
      employee_id: resultReport.employee_id,
      employee_name: resultReport.employee_name,
      report_date: resultReport.report_date,
      today_updates: resultReport.today_updates,
      challenges_blockers: resultReport.challenges_blockers || null,
      plan_for_tomorrow: resultReport.plan_for_tomorrow || null,
      hours_worked: resultReport.hours_worked || 8,
      status: resultReport.status || 'Submitted'
    }], { onConflict: 'employee_id,report_date' }).then(res => {
      if (res.error) console.warn('Supabase saveDailyReport sync error:', res.error);
    });
  }

  return resultReport;
};

export const updateLocalDailyReport = (id: string, updates: Partial<EmployeeDailyReport>): EmployeeDailyReport | null => {
  const reports = getLocalDailyReports();
  const index = reports.findIndex(r => String(r.id) === String(id));
  if (index !== -1) {
    reports[index] = { ...reports[index], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem('local_employee_daily_reports', JSON.stringify(reports));

    if (isSupabaseConfigured() && supabase) {
      supabase.from('employee_daily_reports').update(updates).eq('id', id).then();
    }

    return reports[index];
  }
  return null;
};

export const deleteLocalDailyReport = (id: string): void => {
  const reports = getLocalDailyReports();
  const idStr = String(id);
  const filtered = reports.filter(r => String(r.id) !== idStr);
  localStorage.setItem('local_employee_daily_reports', JSON.stringify(filtered));

  if (isSupabaseConfigured() && supabase) {
    supabase.from('employee_daily_reports').delete().eq('id', id).then();
  }

  // Blacklist deleted ID so Supabase fetch or component reloads never resurrect it
  try {
    const rawDeleted = localStorage.getItem('deleted_daily_report_ids');
    const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    if (!deletedIds.includes(idStr)) {
      deletedIds.push(idStr);
      localStorage.setItem('deleted_daily_report_ids', JSON.stringify(deletedIds));
    }
  } catch (e) {
    console.error('Error recording deleted daily report id:', e);
  }
};

export const getEmployeeDailyReports = (employeeId: string): EmployeeDailyReport[] => {
  const reports = getLocalDailyReports();
  return reports
    .filter(r => r.employee_id === employeeId)
    .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
};

// ==========================================
// USER AUTHENTICATION & SESSION
// ==========================================

export const getCurrentUserSession = (): UserSession | null => {
  try {
    const raw = localStorage.getItem('currentUserSession');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading currentUserSession:', e);
    return null;
  }
};

export const setCurrentUserSession = (session: UserSession | null): void => {
  if (session) {
    localStorage.setItem('currentUserSession', JSON.stringify(session));
    localStorage.setItem('isAuthenticated', 'true');
  } else {
    localStorage.removeItem('currentUserSession');
    localStorage.removeItem('isAuthenticated');
  }
};

