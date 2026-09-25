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

export interface Note {
  id: string;
  content: string;
  timestamp: string;
  reminderDate?: string;
  is_completed?: boolean;
  action_item?: 'Pending' | 'Completed' | string;
}

export interface UserSession {
  role: 'admin' | 'employee';
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
    interested: null,
    follow_up_done: null,
    can_follow_up: null,
    next_reminder_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago (due now)
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
    interested: true,
    follow_up_done: null,
    can_follow_up: null,
    next_reminder_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    last_reminded_at: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
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
  return newCourse;
}

export function deleteLocalCourse(id: string): void {
  const courses = getLocalCourses();
  const filtered = courses.filter(c => c.id !== id);
  setStorageItem('courses', filtered);
}

export function getLocalEnquiries(): Enquiry[] {
  return getStorageItem<Enquiry[]>('enquiries', DEFAULT_ENQUIRIES);
}

export function addLocalEnquiry(enquiry: Omit<Enquiry, 'id' | 'created_at' | 'updated_at' | 'next_reminder_at' | 'last_reminded_at'>): Enquiry {
  const enquiries = getLocalEnquiries();
  const now = new Date();
  
  // reminder date is 2 days from now
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
  return updated;
}

export function deleteLocalEnquiry(id: string): void {
  const enquiries = getLocalEnquiries();
  const filtered = enquiries.filter(e => e.id !== id);
  setStorageItem('enquiries', filtered);
}

export function resetLocalDatabase(): void {
  localStorage.removeItem(STORAGE_PREFIX + 'categories');
  localStorage.removeItem(STORAGE_PREFIX + 'courses');
  localStorage.removeItem(STORAGE_PREFIX + 'enquiries');
  localStorage.removeItem(STORAGE_PREFIX + 'notes');
}

export function getLocalNotes(): Note[] {
  return getStorageItem<Note[]>('notes', []);
}

export function saveLocalNote(note: Omit<Note, 'id' | 'timestamp'>): Note {
  const notes = getLocalNotes();
  const newNote: Note = {
    ...note,
    id: 'note-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString()
  };
  notes.unshift(newNote); // Add to beginning
  setStorageItem('notes', notes);
  return newNote;
}

export function updateLocalNote(id: string, updates: Partial<Note>): Note {
  const notes = getLocalNotes();
  const index = notes.findIndex(n => n.id === id);
  if (index === -1) {
    throw new Error(`Note not found with ID: ${id}`);
  }

  const current = notes[index];
  const updated: Note = {
    ...current,
    ...updates,
    // Keep original timestamp
  };

  notes[index] = updated;
  setStorageItem('notes', notes);
  return updated;
}

export function deleteLocalNote(id: string): void {
  const notes = getLocalNotes();
  const filtered = notes.filter(n => n.id !== id);
  setStorageItem('notes', filtered);
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
  const employees = getLocalEmployees();
  const newEmployee: Employee = {
    ...employee,
    id: 'emp-' + Math.random().toString(36).substr(2, 9),
    created_at: employee.created_at || new Date().toISOString()
  };
  employees.unshift(newEmployee);
  setStorageItem('employees', employees);
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
  return updated;
}

export function deleteLocalEmployee(id: string): void {
  const employees = getLocalEmployees();
  const filtered = employees.filter(e => e.id !== id);
  setStorageItem('employees', filtered);
}

// Employee Credentials Store (for locally storing / caching employee portal passwords)
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

export function getEmployeePassword(emp: Employee): string {
  if (emp.password) return emp.password;
  const creds = getEmployeeCredentials();
  if (emp.id && creds[emp.id.toLowerCase()]) return creds[emp.id.toLowerCase()];
  if (emp.email && creds[emp.email.toLowerCase()]) return creds[emp.email.toLowerCase()];
  if (emp.username && creds[emp.username.toLowerCase()]) return creds[emp.username.toLowerCase()];
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
    const merged: Employee = {
      ...existing,
      ...sEmp,
      email: sEmp.email || existing?.email,
      username: sEmp.username || existing?.username || (sEmp.email ? sEmp.email.split('@')[0] : sEmp.name.toLowerCase().replace(/\s+/g, '')),
      password: existing?.password || getEmployeePassword(sEmp)
    };
    localMap.set(sEmp.id, merged);
    if (merged.email) {
      localMap.set(merged.email.toLowerCase(), merged);
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
          const customPass = (found.id && creds[found.id.toLowerCase()]) || 
                             (found.email && creds[found.email.toLowerCase()]) || 
                             'password123';
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
  return newTask;
};

export const updateLocalEmployeeTask = (id: string, updates: Partial<EmployeeTask>): EmployeeTask | null => {
  const tasks = getLocalEmployeeTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    localStorage.setItem('local_employee_tasks', JSON.stringify(tasks));
    return tasks[index];
  }
  return null;
};

export const deleteLocalEmployeeTask = (id: string): void => {
  const tasks = getLocalEmployeeTasks();
  const filtered = tasks.filter(t => t.id !== id);
  localStorage.setItem('local_employee_tasks', JSON.stringify(filtered));
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
    const data = localStorage.getItem('local_employee_daily_reports');
    if (!data) {
      localStorage.setItem('local_employee_daily_reports', JSON.stringify(DEFAULT_DAILY_REPORTS));
      return DEFAULT_DAILY_REPORTS;
    }
    const parsed: EmployeeDailyReport[] = JSON.parse(data);
    return parsed;
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

  if (existingIndex !== -1) {
    // Update existing report for today
    const updated: EmployeeDailyReport = {
      ...reports[existingIndex],
      ...report,
      updated_at: new Date().toISOString()
    };
    reports[existingIndex] = updated;
    localStorage.setItem('local_employee_daily_reports', JSON.stringify(reports));
    return updated;
  }

  const newReport: EmployeeDailyReport = {
    ...report,
    id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  reports.unshift(newReport);
  localStorage.setItem('local_employee_daily_reports', JSON.stringify(reports));
  return newReport;
};

export const updateLocalDailyReport = (id: string, updates: Partial<EmployeeDailyReport>): EmployeeDailyReport | null => {
  const reports = getLocalDailyReports();
  const index = reports.findIndex(r => r.id === id);
  if (index !== -1) {
    reports[index] = { ...reports[index], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem('local_employee_daily_reports', JSON.stringify(reports));
    return reports[index];
  }
  return null;
};

export const deleteLocalDailyReport = (id: string): void => {
  const reports = getLocalDailyReports();
  const filtered = reports.filter(r => r.id !== id);
  localStorage.setItem('local_employee_daily_reports', JSON.stringify(filtered));
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

