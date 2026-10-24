// =========================================================================
// Global Minds Lead Tracker - Central Domain Types
// =========================================================================

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

export interface WorkstreamCategoryMeta {
  value: SalesWorkstreamCategory;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

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
