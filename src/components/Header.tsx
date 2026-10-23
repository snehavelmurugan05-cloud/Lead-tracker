import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Bell,
  Search,
  Sun,
  Moon,
  X,
  User,
  Phone,
  BookOpen,
  StickyNote,
  Clock,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  FolderOpen,
  Check,
  RotateCcw,
  Plus,
  CheckCircle
} from 'lucide-react';
import {
  type UserSession,
  getLocalNotes,
  getLocalEnquiries,
  getLocalCourses,
  getLocalEmployeeTasks,
  resolveNoteStage,
  updateLocalNote,
  syncLocalSalesNotes,
  type Note,
  type Enquiry,
  type Course,
  type EmployeeTask
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser?: UserSession | null;
  pendingCount?: number;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
  searchQuery?: string;
  onSearch?: (query: string) => void;
  onNavigateToLead?: (contactName: string) => void;
  refreshTrigger?: number;
  onUpdate?: () => void;
}

const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Target Customer': { bg: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)' },
  'Lead Generation': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' },
  'Demo': { bg: 'rgba(147, 51, 234, 0.12)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.3)' },
  'Requirement Gathering': { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)' },
  'Estimation': { bg: 'rgba(71, 121, 135, 0.15)', color: '#477987', border: 'rgba(71, 121, 135, 0.3)' },
  'Proposal': { bg: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.3)' },
  'Customer Onboarding': { bg: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c', border: 'rgba(27, 163, 124, 0.3)' },
  // Legacy stages fallback
  'Cold Email Outreach': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' },
  'Lead Research': { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
  'Initial Call': { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)' },
  'Requirement Identification': { bg: 'rgba(147, 51, 234, 0.12)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.3)' },
  'Requirement-Based Email Sent': { bg: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', border: 'rgba(13, 148, 136, 0.3)' },
  'Partnership Proposal': { bg: 'rgba(225, 29, 72, 0.12)', color: '#e11d48', border: 'rgba(225, 29, 72, 0.3)' },
  'Partnership Conversation': { bg: 'rgba(5, 150, 105, 0.12)', color: '#059669', border: 'rgba(5, 150, 105, 0.3)' },
  'Partnership Followup': { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
  'Reached Out': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.3)' },
  'Pipeline': { bg: 'rgba(71, 121, 135, 0.15)', color: '#477987', border: 'rgba(71, 121, 135, 0.3)' },
  'Converted': { bg: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c', border: 'rgba(27, 163, 124, 0.3)' },
  'To Be Follow Up': { bg: 'rgba(217, 119, 6, 0.15)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)' },
  'Delivery Due': { bg: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.3)' }
};

const formatRelativeDue = (dateStr?: string) => {
  if (!dateStr) return { text: 'No alert date', color: '#5b7b88', bg: '#f1f5f9', border: '#cbe0e8', isOverdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { text: `Overdue ${days}d`, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.3)', isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'Due Today', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.15)', border: 'rgba(234, 88, 12, 0.35)', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Due Tomorrow', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', border: 'rgba(2, 132, 199, 0.3)', isOverdue: false };
  } else {
    return { text: `Due in ${diffDays}d`, color: '#477987', bg: 'rgba(71, 121, 135, 0.12)', border: 'rgba(71, 121, 135, 0.3)', isOverdue: false };
  }
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  pendingCount = 0,
  theme = 'light',
  toggleTheme,
  searchQuery,
  onSearch,
  onNavigateToLead,
  refreshTrigger,
  onUpdate
}) => {
  const [time, setTime] = useState(new Date());
  const [internalSearch, setInternalSearch] = useState(searchQuery || '');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [salesFilter, setSalesFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const isSales = currentUser?.role === 'sales';

  // Live synchronizing sales notes state
  const [salesNotes, setSalesNotes] = useState<Note[]>(() => isSales ? getLocalNotes('sales') : []);

  useEffect(() => {
    const syncSalesNotes = async () => {
      if (isSales) {
        if (isSupabaseConfigured() && supabase) {
          try {
            const { data } = await supabase
              .from('notes')
              .select('*')
              .eq('role', 'sales')
              .order('timestamp', { ascending: false });
            if (data && data.length > 0) {
              const strictlySales = (data as Note[]).filter(
                n => n.role === 'sales' && n.created_by !== 'Admin' && !String(n.id).startsWith('sales-note-today-')
              );
              if (strictlySales.length > 0) {
                syncLocalSalesNotes(strictlySales);
              }
            }
          } catch (err) {
            // fallback to local storage
          }
        }
        setSalesNotes(getLocalNotes('sales'));
      }
    };
    syncSalesNotes();
    window.addEventListener('sales-notes-updated', syncSalesNotes);
    window.addEventListener('notes-updated', syncSalesNotes);
    window.addEventListener('storage', syncSalesNotes);
    return () => {
      window.removeEventListener('sales-notes-updated', syncSalesNotes);
      window.removeEventListener('notes-updated', syncSalesNotes);
      window.removeEventListener('storage', syncSalesNotes);
    };
  }, [isSales, refreshTrigger]);

  useEffect(() => {
    if (isNotifOpen && isSales) {
      setSalesNotes(getLocalNotes('sales'));
    }
  }, [isNotifOpen, isSales]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (searchQuery !== undefined) {
      setInternalSearch(searchQuery);
    }
  }, [searchQuery]);

  // Handle clicking outside of dropdown popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Title and subtitle helper
  const getTitleDetails = () => {
    switch (activeTab) {
      case 'employee-tasks':
        return {
          title: 'My Tasks',
          subtitle: `Assigned tasks and daily responsibilities for ${currentUser?.name || 'Employee'}.`
        };
      case 'daily-reports':
        return {
          title: 'Daily Work Report',
          subtitle: 'Submit today\'s progress update and review long-term reporting archive.'
        };
      case 'notes':
        return {
          title: isSales ? 'Sales Recent Notes' : 'Recent Notes',
          subtitle: isSales
            ? 'Capture client conversation details, track pipeline stages, and follow-up reminders.'
            : 'Record administrative, operational, and facility management notes.'
        };
      case 'dashboard':
        return {
          title: isSales ? 'Sales Dashboard' : 'Admin Hub',
          subtitle: isSales
            ? 'Overview of student and client leads, follow-up statuses, and enquiries ledger.'
            : 'Every open lead, its reminder status, and the full tracking ledger.'
        };
      case 'leads':
        return {
          title: 'Lead Management',
          subtitle: 'Register new student and client enquiries with live course selection and follow-ups.'
        };
      case 'pending-tasks':
        return {
          title: 'Activity Center',
          subtitle: 'View and manage all lead follow-ups organized by alert due date.'
        };
      case 'pending-notes':
        return {
          title: 'Pending Notes',
          subtitle: 'Track unresolved follow-up reminders and scheduled note alerts.'
        };
      case 'conversion':
        return {
          title: 'Conversion Hub',
          subtitle: 'Track converted admissions, monitor conversion ratios, and track tuition revenue.'
        };
      case 'courses':
        return {
          title: 'Course Library',
          subtitle: 'Browse all available offering categories, courses, and fees.'
        };
      case 'manage-courses':
        return {
          title: 'Course Management',
          subtitle: 'Create and modify categories, courses, descriptions, and pricing structure.'
        };
      case 'student-module':
        return {
          title: 'Student',
          subtitle: 'View created courses and enrolled student details.'
        };
      case 'settings':
        return {
          title: 'System Settings',
          subtitle: 'Configure your Supabase backend and Gemini API keys.'
        };
      default:
        return {
          title: 'Admin Hub',
          subtitle: 'Every open lead, its reminder status, and the full tracking ledger.'
        };
    }
  };

  const { title, subtitle } = getTitleDetails();

  // Format: "Sat, Sep 19 12:33:06 PM"
  const formattedDateString = `${time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalSearch(val);
    setIsSearchOpen(true);
    if (onSearch) {
      onSearch(val);
    }
  };

  const handleClearSearch = () => {
    setInternalSearch('');
    setIsSearchOpen(false);
    if (onSearch) {
      onSearch('');
    }
  };

  // ----------------------------------------------------
  // Sales Notification Data (Driven by Sales Recent Notes)
  // ----------------------------------------------------
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Helper to determine if a stage is converted / completed
  const isCompletedStage = (stg: string | null | undefined) => 
    Boolean(stg && (stg === 'Customer Onboarding' || stg === 'Converted'));

  // Active uncompleted sales notes
  const activeSalesNotes = isSales ? salesNotes.filter(n => {
    if (n.is_completed) return false;
    if (n.stage === 'Converted' || n.stage === 'Customer Onboarding') return false;
    if (n.action_item === 'Converted') return false;
    if (isCompletedStage(resolveNoteStage(n))) return false;
    return true;
  }) : [];

  // Grouped notes
  const overdueSalesNotes = activeSalesNotes
    .filter(n => n.reminderDate && n.reminderDate < todayDateStr)
    .sort((a, b) => new Date(a.reminderDate!).getTime() - new Date(b.reminderDate!).getTime());

  const todaySalesNotes = activeSalesNotes
    .filter(n => n.reminderDate && n.reminderDate === todayDateStr)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const upcomingSalesNotes = activeSalesNotes
    .filter(n => n.reminderDate && n.reminderDate > todayDateStr)
    .sort((a, b) => new Date(a.reminderDate!).getTime() - new Date(b.reminderDate!).getTime());

  const otherActionNotes = activeSalesNotes
    .filter(n => !n.reminderDate && (n.stage === 'To Be Follow Up' || n.stage === 'Delivery Due'))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const allSalesReminders = [
    ...overdueSalesNotes,
    ...todaySalesNotes,
    ...upcomingSalesNotes,
    ...otherActionNotes
  ];

  // Filtered sales reminders according to active tab
  let displayedSalesReminders = allSalesReminders;
  if (salesFilter === 'overdue') displayedSalesReminders = overdueSalesNotes;
  else if (salesFilter === 'today') displayedSalesReminders = todaySalesNotes;
  else if (salesFilter === 'upcoming') displayedSalesReminders = upcomingSalesNotes;

  // Notification action handlers
  const handleMarkConverted = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    // 1. Direct update to Supabase DB
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('notes').update({
          is_completed: true,
          stage: 'Converted',
          action_item: 'Converted',
          reminderDate: null
        }).eq('id', noteId);
      } catch (err) {
        console.error('Error marking converted in Supabase:', err);
      }
    }
    // 2. Update local storage
    updateLocalNote(noteId, { is_completed: true, stage: 'Converted', action_item: 'Converted', reminderDate: undefined }, 'sales');
    setSalesNotes(getLocalNotes('sales'));
    setQuickFeedback('Marked as Converted!');
    setTimeout(() => setQuickFeedback(null), 2500);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sales-notes-updated'));
      window.dispatchEvent(new CustomEvent('notes-updated'));
    }
    if (onUpdate) onUpdate();
  };

  const handlePostponeTwoDays = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const base = note.reminderDate && note.reminderDate > todayDateStr ? new Date(note.reminderDate) : new Date();
    base.setDate(base.getDate() + 2);
    const newDateStr = base.toISOString().split('T')[0];
    
    // 1. Direct update to Supabase DB
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('notes').update({
          reminderDate: newDateStr
        }).eq('id', note.id);
      } catch (err) {
        console.error('Error postponing reminder in Supabase:', err);
      }
    }
    // 2. Update local storage
    updateLocalNote(note.id, { reminderDate: newDateStr }, 'sales');
    setSalesNotes(getLocalNotes('sales'));
    setQuickFeedback(`Postponed 2 days (Due ${newDateStr})`);
    setTimeout(() => setQuickFeedback(null), 2500);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sales-notes-updated'));
      window.dispatchEvent(new CustomEvent('notes-updated'));
    }
    if (onUpdate) onUpdate();
  };

  const handleCardClick = (noteId: string) => {
    setIsNotifOpen(false);
    if (isSales) {
      setActiveTab('notes');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('focus-sales-note', { detail: { noteId } }));
        }
      }, 100);
    }
  };

  const handleScrollToSalesNotes = () => {
    setIsNotifOpen(false);
    if (isSales) {
      setActiveTab('notes');
    }
  };

  const handleFocusSalesQuickNote = () => {
    setIsNotifOpen(false);
    if (isSales) {
      setActiveTab('notes');
      setTimeout(() => {
        const ta = document.getElementById('sales-quick-note-textarea');
        if (ta) {
          ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
          ta.focus();
        }
      }, 100);
    }
  };

  // ----------------------------------------------------
  // Role Detection
  // ----------------------------------------------------
  const isEmployee = currentUser?.role === 'employee';
  const isAdmin = !isSales && !isEmployee;

  // ----------------------------------------------------
  // Employee Notification Data (Assigned Tasks)
  // ----------------------------------------------------
  const employeeTasks: EmployeeTask[] = isEmployee ? getLocalEmployeeTasks() : [];
  const empId = (currentUser?.id || '').toLowerCase();
  const empUser = (currentUser?.username || '').toLowerCase();
  const empName = (currentUser?.name || '').toLowerCase();

  const myEmployeePendingTasks: EmployeeTask[] = isEmployee
    ? employeeTasks.filter(t => {
        if (t.status === 'Completed') return false;
        const assignedId = (t.employee_id || '').toLowerCase();
        return (
          assignedId === empId ||
          (empUser && assignedId.includes(empUser)) ||
          (empName && assignedId.includes(empName))
        );
      })
    : [];

  // ----------------------------------------------------
  // Admin Notification Data (Strictly Admin only)
  // ----------------------------------------------------
  const adminEnquiries: Enquiry[] = isAdmin ? getLocalEnquiries() : [];
  const adminDueEnquiries: Enquiry[] = isAdmin
    ? adminEnquiries.filter(e => {
        const isUnresolved = e.interested === null || e.follow_up_done === null || e.can_follow_up === null;
        return isUnresolved;
      })
    : [];
  const adminNotes: Note[] = isAdmin ? getLocalNotes('admin') : [];
  const adminDueNotes: Note[] = isAdmin
    ? adminNotes.filter(n => n.reminderDate && !n.is_completed)
    : [];

  // Notification badge count - Strictly segregated by role (urgent due + overdue items)
  const effectiveNotificationCount = isSales
    ? (overdueSalesNotes.length + todaySalesNotes.length + otherActionNotes.length)
    : isEmployee
    ? myEmployeePendingTasks.length
    : (pendingCount > 0 ? pendingCount : (adminDueEnquiries.length + adminDueNotes.length));

  // ----------------------------------------------------
  // Search Matches Generation
  // ----------------------------------------------------
  const cleanQuery = internalSearch.trim().toLowerCase();

  // Employee Search: searches employee's assigned tasks
  const matchingEmployeeTasks: EmployeeTask[] = (isEmployee && cleanQuery)
    ? employeeTasks.filter(t =>
        t.title.toLowerCase().includes(cleanQuery) ||
        (t.description && t.description.toLowerCase().includes(cleanQuery))
      )
    : [];

  // Sales Search: searches sales recent notes
  const matchingSalesNotes: Note[] = (isSales && cleanQuery)
    ? salesNotes.filter(n =>
        n.content.toLowerCase().includes(cleanQuery) ||
        (n.stage && n.stage.toLowerCase().includes(cleanQuery))
      )
    : [];

  // Admin Search: searches leads, notes, and courses (Admin only)
  const allCourses: Course[] = isAdmin && cleanQuery ? getLocalCourses() : [];
  const matchingLeads: Enquiry[] = (isAdmin && cleanQuery)
    ? adminEnquiries.filter(e => {
        const c = allCourses.find(course => course.id === e.course_id);
        return e.contact_name.toLowerCase().includes(cleanQuery) ||
          (e.contact_phone && e.contact_phone.includes(cleanQuery)) ||
          (c && c.name.toLowerCase().includes(cleanQuery)) ||
          (e.notes && e.notes.toLowerCase().includes(cleanQuery));
      })
    : [];

  const matchingAdminNotes: Note[] = (isAdmin && cleanQuery)
    ? adminNotes.filter(n =>
        n.content.toLowerCase().includes(cleanQuery) ||
        (n.stage && n.stage.toLowerCase().includes(cleanQuery))
      )
    : [];

  const matchingCourses: Course[] = (isAdmin && cleanQuery)
    ? allCourses.filter(c =>
        c.name.toLowerCase().includes(cleanQuery) ||
        (c.description && c.description.toLowerCase().includes(cleanQuery))
      )
    : [];

  const totalAdminSearchResults = matchingLeads.length + matchingAdminNotes.length + matchingCourses.length;

  return (
    <header className="main-header">
      <div className="header-title-section">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="header-actions">
        {/* Real-time Date & Time Pill (Matching Reference UI) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbe0e8',
            borderRadius: '9999px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#345967',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
          }}
        >
          <Calendar size={14} style={{ color: '#5b7b88' }} />
          <span>{formattedDateString}</span>
        </div>

        {/* ======================================================== */}
        {/* SEARCH BAR & NOTIFICATION BELL GROUP (Directly Adjacent) */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* SEARCH BAR (Functional for both Admin & Sales) */}
          <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={isSales ? 'Search sales notes...' : isEmployee ? 'Search my tasks...' : 'Search leads, notes...'}
                value={internalSearch}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (internalSearch.trim()) setIsSearchOpen(true);
                }}
                style={{
                  padding: '7px 32px 7px 16px',
                  backgroundColor: '#ffffff',
                  border: isSearchOpen && internalSearch.trim() ? '1px solid #1f4854' : '1px solid #cbe0e8',
                  borderRadius: '9999px',
                  fontSize: '12.5px',
                  color: '#162e3b',
                  outline: 'none',
                  width: '210px',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease'
                }}
              />
              {internalSearch ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#7a9aa7',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    color: '#7a9aa7',
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>

            {/* Search Results Dropdown Popover */}
            {isSearchOpen && internalSearch.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '380px',
                  maxHeight: '440px',
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #cbe0e8',
                  boxShadow: '0 14px 35px rgba(0, 0, 0, 0.14)',
                  zIndex: 1100,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  animation: 'fade-in 0.15s ease'
                }}
              >
                {/* SALES SEARCH DROPDOWN */}
                {isSales ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #eef4f7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#1f4854' }}>
                        <StickyNote size={14} style={{ color: '#477987' }} />
                        <span>Sales Recent Notes ({matchingSalesNotes.length})</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#5b7b88' }}>
                        Reflects in Sales Only
                      </span>
                    </div>

                    {matchingSalesNotes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 12px', color: '#5b7b88', fontSize: '13px' }}>
                        No sales notes matching <strong style={{ color: '#162e3b' }}>"{internalSearch}"</strong>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchingSalesNotes.slice(0, 8).map(n => {
                          const stage = resolveNoteStage(n);
                          const theme = stage ? (STAGE_COLORS[stage] || STAGE_COLORS['Reached Out']) : STAGE_COLORS['Reached Out'];
                          return (
                            <div
                              key={n.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                handleCardClick(n.id);
                              }}
                              style={{
                                padding: '9px 12px',
                                borderRadius: '8px',
                                border: '1px solid #eef4f7',
                                backgroundColor: '#fcfdfd',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f7f9')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fcfdfd')}
                              title="Click to jump to this note on Sales Dashboard"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: theme.bg,
                                    color: theme.color,
                                    border: `1px solid ${theme.border}`
                                  }}
                                >
                                  {stage}
                                </span>
                                <span style={{ fontSize: '11px', color: '#7a9aa7' }}>
                                  {new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#162e3b', fontWeight: 500, lineHeight: 1.4 }}>
                                {n.content}
                              </div>
                            </div>
                          );
                        })}
                        {matchingSalesNotes.length > 8 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSearchOpen(false);
                              handleScrollToSalesNotes();
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '6px', textAlign: 'center', marginTop: '4px' }}
                          >
                            View all {matchingSalesNotes.length} matching notes →
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : isEmployee ? (
                  /* EMPLOYEE SEARCH DROPDOWN */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid #eef4f7' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1f4854' }}>
                        My Tasks ({matchingEmployeeTasks.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSearchOpen(false)}
                        style={{ background: 'none', border: 'none', color: '#7a9aa7', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {matchingEmployeeTasks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 12px', color: '#5b7b88', fontSize: '13px' }}>
                        No tasks found matching <strong style={{ color: '#162e3b' }}>"{internalSearch}"</strong>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchingEmployeeTasks.map(task => {
                          const priorityColor =
                            task.priority === 'High' ? '#dc2626' :
                            task.priority === 'Medium' ? '#d97706' : '#2563eb';
                          const priorityBg =
                            task.priority === 'High' ? 'rgba(220, 38, 38, 0.1)' :
                            task.priority === 'Medium' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(37, 99, 235, 0.1)';

                          return (
                            <div
                              key={task.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                setActiveTab('employee-tasks');
                              }}
                              style={{
                                padding: '9px 12px',
                                borderRadius: '8px',
                                border: '1px solid #eef4f7',
                                backgroundColor: '#fcfdfd',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f7f9')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fcfdfd')}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backgroundColor: priorityBg, color: priorityColor }}>
                                  {task.priority || 'Normal'} Priority
                                </span>
                                <span style={{ fontSize: '11px', color: task.status === 'Completed' ? '#10b981' : '#d97706', fontWeight: 700 }}>
                                  {task.status}
                                </span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#162e3b', fontWeight: 600 }}>
                                {task.title}
                              </div>
                              {task.description && (
                                <div style={{ fontSize: '11.5px', color: '#5b7b88', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {task.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  /* ADMIN SEARCH DROPDOWN (Leads, Notes, Courses) */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid #eef4f7' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1f4854' }}>
                        Admin Search Results ({totalAdminSearchResults})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSearchOpen(false)}
                        style={{ background: 'none', border: 'none', color: '#7a9aa7', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {totalAdminSearchResults === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 12px', color: '#5b7b88', fontSize: '13px' }}>
                        No leads, notes, or courses found matching <strong style={{ color: '#162e3b' }}>"{internalSearch}"</strong>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Section: Leads */}
                        {matchingLeads.length > 0 && (
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#477987', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <User size={13} />
                              <span>Leads / Enquiries ({matchingLeads.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {matchingLeads.slice(0, 4).map(lead => {
                                const course = allCourses.find(c => c.id === lead.course_id);
                                return (
                                  <div
                                    key={lead.id}
                                    onClick={() => {
                                      setIsSearchOpen(false);
                                      if (onNavigateToLead) {
                                        onNavigateToLead(lead.contact_name);
                                      } else {
                                        setActiveTab('dashboard');
                                      }
                                    }}
                                    style={{
                                      padding: '7px 10px',
                                      borderRadius: '6px',
                                      backgroundColor: '#f8fafc',
                                      border: '1px solid #eef4f7',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eef5f8')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  >
                                    <div>
                                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#162e3b' }}>
                                        {lead.contact_name}
                                      </div>
                                      <div style={{ fontSize: '11.5px', color: '#5b7b88' }}>
                                        {course?.name || 'General Inquiry'} • {lead.contact_phone || 'No phone'}
                                      </div>
                                    </div>
                                    <ChevronRight size={14} style={{ color: '#7a9aa7' }} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Section: Admin Notes */}
                        {matchingAdminNotes.length > 0 && (
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#477987', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <StickyNote size={13} />
                              <span>Admin Notes ({matchingAdminNotes.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {matchingAdminNotes.slice(0, 3).map(n => {
                                const isCompleted = Boolean(n.is_completed || n.action_item === 'Completed');
                                const statusLabel = isCompleted ? 'Completed' : 'Pending';
                                const statusColor = isCompleted ? '#1ba37c' : '#d97706';
                                const statusBg = isCompleted ? 'rgba(27, 163, 124, 0.12)' : 'rgba(217, 119, 6, 0.12)';
                                return (
                                  <div
                                    key={n.id}
                                    onClick={() => {
                                      setIsSearchOpen(false);
                                      setActiveTab('notes');
                                    }}
                                    style={{
                                      padding: '7px 10px',
                                      borderRadius: '6px',
                                      backgroundColor: '#f8fafc',
                                      border: '1px solid #eef4f7',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '3px'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eef5f8')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: statusColor, backgroundColor: statusBg, padding: '2px 8px', borderRadius: '10px' }}>
                                        {statusLabel}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#7a9aa7' }}>
                                        {new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#162e3b', lineHeight: 1.3 }}>
                                      {n.content}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Section: Courses */}
                        {matchingCourses.length > 0 && (
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#477987', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <FolderOpen size={13} />
                              <span>Courses ({matchingCourses.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {matchingCourses.slice(0, 3).map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setIsSearchOpen(false);
                                    setActiveTab('courses');
                                  }}
                                  style={{
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #eef4f7',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eef5f8')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                >
                                  <div>
                                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#162e3b' }}>{c.name}</div>
                                    <div style={{ fontSize: '11.5px', color: '#5b7b88' }}>{c.fee}</div>
                                  </div>
                                  <ChevronRight size={14} style={{ color: '#7a9aa7' }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* NOTIFICATION BELL ICON (Directly next to the search bar) */}
          {/* ======================================================== */}
          <div ref={notifContainerRef} style={{ position: 'relative' }}>
            <button
              id="header-notification-bell-btn"
              onClick={() => setIsNotifOpen(prev => !prev)}
              title={isSales ? 'Sales Reminders & Follow-ups' : isEmployee ? 'My Task Notifications' : 'View Pending Tasks & Alert Days'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                position: 'relative',
                cursor: 'pointer',
                border: isNotifOpen ? '1.5px solid #1f4854' : '1px solid #cbe0e8',
                backgroundColor: isNotifOpen ? 'rgba(71, 121, 135, 0.12)' : '#ffffff',
                color: '#345967',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.2s ease',
                padding: 0
              }}
            >
              <Bell size={18} />
              {effectiveNotificationCount > 0 && (
                <span
                  id="notification-badge-count"
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 800,
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9999px',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(234, 88, 12, 0.45)',
                    border: '2px solid #ffffff'
                  }}
                >
                  {effectiveNotificationCount > 99 ? '99+' : effectiveNotificationCount}
                </span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {isNotifOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '380px',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #cbe0e8',
                  boxShadow: '0 16px 45px rgba(0, 0, 0, 0.16)',
                  zIndex: 1100,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  animation: 'fade-in 0.15s ease'
                }}
              >
                {/* SALES NOTIFICATIONS (Driven by Sales Recent Notes) */}
                {isSales ? (
                  <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #eef4f7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(234, 88, 12, 0.14)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Bell size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#162e3b' }}>
                            Sales Reminders
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#5b7b88' }}>
                            Driven by sales recent notes
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {overdueSalesNotes.length > 0 && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(220, 38, 38, 0.12)',
                              color: '#dc2626',
                              border: '1px solid rgba(220, 38, 38, 0.25)',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            {overdueSalesNotes.length} Overdue
                          </span>
                        )}
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: allSalesReminders.length > 0 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(27, 163, 124, 0.12)',
                            color: allSalesReminders.length > 0 ? '#ea580c' : '#1ba37c',
                            border: allSalesReminders.length > 0 ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid rgba(27, 163, 124, 0.25)',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          {allSalesReminders.length} Due
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Toast */}
                    {quickFeedback && (
                      <div
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'rgba(27, 163, 124, 0.12)',
                          border: '1px solid rgba(27, 163, 124, 0.3)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#1ba37c',
                          fontWeight: 600,
                          textAlign: 'center',
                          animation: 'fade-in 0.15s ease'
                        }}
                      >
                        ✓ {quickFeedback}
                      </div>
                    )}

                    {/* Filter Tabs (All / Overdue / Today / Upcoming) */}
                    <div style={{ display: 'flex', gap: '5px', backgroundColor: '#f1f7f9', padding: '3px', borderRadius: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSalesFilter('all')}
                        style={{
                          flex: 1,
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: salesFilter === 'all' ? '#ffffff' : 'transparent',
                          color: salesFilter === 'all' ? '#1f4854' : '#5b7b88',
                          boxShadow: salesFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        All ({allSalesReminders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalesFilter('overdue')}
                        style={{
                          flex: 1,
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: salesFilter === 'overdue' ? '#dc2626' : 'transparent',
                          color: salesFilter === 'overdue' ? '#ffffff' : overdueSalesNotes.length > 0 ? '#dc2626' : '#5b7b88',
                          boxShadow: salesFilter === 'overdue' ? '0 1px 3px rgba(220,38,38,0.3)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Overdue ({overdueSalesNotes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalesFilter('today')}
                        style={{
                          flex: 1,
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: salesFilter === 'today' ? '#ffffff' : 'transparent',
                          color: salesFilter === 'today' ? '#ea580c' : '#5b7b88',
                          boxShadow: salesFilter === 'today' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Today ({todaySalesNotes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalesFilter('upcoming')}
                        style={{
                          flex: 1,
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: salesFilter === 'upcoming' ? '#ffffff' : 'transparent',
                          color: salesFilter === 'upcoming' ? '#0284c7' : '#5b7b88',
                          boxShadow: salesFilter === 'upcoming' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Upcoming ({upcomingSalesNotes.length})
                      </button>
                    </div>

                    {/* Reminder Notes Cards */}
                    {displayedSalesReminders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(27, 163, 124, 0.1)', color: '#1ba37c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={22} />
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#162e3b' }}>
                          {salesFilter === 'overdue' ? 'No overdue reminders!' : salesFilter === 'today' ? 'No reminders due today!' : salesFilter === 'upcoming' ? 'No upcoming reminders scheduled' : 'All caught up!'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#5b7b88', maxWidth: '240px' }}>
                          {salesFilter === 'all'
                            ? 'No active follow-ups or alerts pending in your sales notes.'
                            : 'Try switching to another tab or check the Sales Notes ledger.'}
                        </div>
                        <button
                          type="button"
                          onClick={handleScrollToSalesNotes}
                          className="btn btn-secondary"
                          style={{ marginTop: '4px', fontSize: '12px', padding: '6px 14px' }}
                        >
                          View all sales notes ({salesNotes.length})
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '310px', overflowY: 'auto' }}>
                        {displayedSalesReminders.map(n => {
                          const stage = resolveNoteStage(n);
                          const theme = stage ? (STAGE_COLORS[stage] || STAGE_COLORS['Reached Out']) : STAGE_COLORS['Reached Out'];
                          const dueStatus = formatRelativeDue(n.reminderDate);

                          return (
                            <div
                              key={n.id}
                              onClick={() => handleCardClick(n.id)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: dueStatus.isOverdue ? '1.5px solid rgba(220, 38, 38, 0.25)' : '1px solid #eef4f7',
                                backgroundColor: dueStatus.isOverdue ? '#fffbfb' : '#fcfdfd',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = dueStatus.isOverdue ? '#fff5f5' : '#f1f7f9')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = dueStatus.isOverdue ? '#fffbfb' : '#fcfdfd')}
                              title="Click to jump to this note on Sales Dashboard"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    backgroundColor: dueStatus.bg,
                                    color: dueStatus.color,
                                    border: `1px solid ${dueStatus.border}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {dueStatus.isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                                  {dueStatus.text}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '8px',
                                    backgroundColor: theme.bg,
                                    color: theme.color,
                                    border: `1px solid ${theme.border}`
                                  }}
                                >
                                  {stage}
                                </span>
                              </div>

                              <div style={{ fontSize: '12.5px', color: '#162e3b', fontWeight: 500, lineHeight: 1.4 }}>
                                {n.content}
                              </div>

                              <div style={{ fontSize: '11px', color: '#7a9aa7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                <span>
                                  {n.reminderDate
                                    ? `Due: ${new Date(n.reminderDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                                    : `Logged: ${new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                                </span>
                                <span style={{ color: '#477987', fontWeight: 600, fontSize: '11px' }}>
                                  View in table →
                                </span>
                              </div>

                              {/* Quick Action Buttons Directly in Notification Card */}
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #f1f5f7' }}>
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkConverted(e, n.id)}
                                  title="Mark note as Converted & Done"
                                  style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(27, 163, 124, 0.3)',
                                    backgroundColor: 'rgba(27, 163, 124, 0.08)',
                                    color: '#1ba37c',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(27, 163, 124, 0.18)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(27, 163, 124, 0.08)')}
                                >
                                  <Check size={12} />
                                  <span>Converted</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handlePostponeTwoDays(e, n)}
                                  title="Postpone reminder by 2 days"
                                  style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbe0e8',
                                    backgroundColor: '#ffffff',
                                    color: '#477987',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f1f7f9')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                                >
                                  <RotateCcw size={11} />
                                  <span>+2 Days</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Popover Footer */}
                    <div style={{ borderTop: '1px solid #eef4f7', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleScrollToSalesNotes}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '12px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <BookOpen size={13} />
                        <span>Sales Notes Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFocusSalesQuickNote}
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '12px', padding: '6px 10px', backgroundColor: '#1f4854', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Plus size={13} />
                        <span>Log New Note</span>
                      </button>
                    </div>
                  </>
                ) : isEmployee ? (
                  /* EMPLOYEE NOTIFICATIONS */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #eef4f7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(31, 72, 84, 0.1)', color: '#1f4854', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#162e3b' }}>
                            My Task Alerts
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#5b7b88' }}>
                            Assigned tasks & deadlines
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: myEmployeePendingTasks.length > 0 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(27, 163, 124, 0.12)',
                          color: myEmployeePendingTasks.length > 0 ? '#ea580c' : '#1ba37c',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {myEmployeePendingTasks.length > 0 ? `${myEmployeePendingTasks.length} Pending` : 'All Caught Up'}
                      </span>
                    </div>

                    {myEmployeePendingTasks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(27, 163, 124, 0.12)', color: '#1ba37c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={22} />
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#162e3b' }}>
                          No Pending Task Alerts
                        </div>
                        <div style={{ fontSize: '12px', color: '#5b7b88', maxWidth: '260px', lineHeight: 1.4 }}>
                          You have completed all your assigned tasks or have no new alerts. Great job!
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                        {myEmployeePendingTasks.map(task => {
                          const priorityColor =
                            task.priority === 'High' ? '#dc2626' :
                            task.priority === 'Medium' ? '#d97706' : '#2563eb';
                          const priorityBg =
                            task.priority === 'High' ? 'rgba(220, 38, 38, 0.1)' :
                            task.priority === 'Medium' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(37, 99, 235, 0.1)';

                          return (
                            <div
                              key={task.id}
                              onClick={() => {
                                setIsNotifOpen(false);
                                setActiveTab('employee-tasks');
                              }}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #eef4f7',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eef5f8')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', backgroundColor: priorityBg, color: priorityColor }}>
                                  {task.priority || 'Normal'} Priority
                                </span>
                                {task.due_date && (
                                  <span style={{ fontSize: '11px', color: '#7a9aa7' }}>
                                    Due {task.due_date}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#162e3b' }}>
                                {task.title}
                              </div>
                              {task.description && (
                                <div style={{ fontSize: '11.5px', color: '#5b7b88', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {task.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #eef4f7', paddingTop: '10px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifOpen(false);
                          setActiveTab('employee-tasks');
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '12px', padding: '7px', backgroundColor: '#1f4854' }}
                      >
                        View My Tasks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifOpen(false);
                          setActiveTab('daily-reports');
                        }}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '12px', padding: '7px' }}
                      >
                        Daily Report
                      </button>
                    </div>
                  </>
                ) : (
                  /* ADMIN NOTIFICATIONS */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #eef4f7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Bell size={15} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#162e3b' }}>
                            Admin Activity Alerts
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#5b7b88' }}>
                            Pending follow-ups & reminders
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(234, 88, 12, 0.12)',
                          color: '#ea580c',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {effectiveNotificationCount} Pending
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Follow-up Leads */}
                      <div
                        onClick={() => {
                          setIsNotifOpen(false);
                          setActiveTab('pending-tasks');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #eef4f7',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eef5f8')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#162e3b' }}>
                            Lead Follow-ups Due
                          </div>
                          <div style={{ fontSize: '12px', color: '#5b7b88' }}>
                            {adminDueEnquiries.length} open enquiries awaiting response
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: '#7a9aa7' }} />
                      </div>

                      {/* Pending Notes */}
                      <div
                        onClick={() => {
                          setIsNotifOpen(false);
                          setActiveTab('pending-notes');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #eef4f7',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eef5f8')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#162e3b' }}>
                            Pending Notes Reminders
                          </div>
                          <div style={{ fontSize: '12px', color: '#5b7b88' }}>
                            {adminDueNotes.length} scheduled note alerts due
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: '#7a9aa7' }} />
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #eef4f7', paddingTop: '10px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifOpen(false);
                          setActiveTab('pending-tasks');
                        }}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '12px', padding: '6px' }}
                      >
                        Activity Center
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifOpen(false);
                          setActiveTab('pending-notes');
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '12px', padding: '6px', backgroundColor: '#1f4854' }}
                      >
                        Pending Notes
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Theme Toggle Pill (Matching Reference UI) */}
        {toggleTheme && (
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbe0e8',
              borderRadius: '9999px',
              cursor: 'pointer',
              color: '#345967',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            <Sun size={14} style={{ color: theme === 'light' ? '#ea580c' : '#7a9aa7' }} />
            <Moon size={14} style={{ color: theme === 'dark' ? '#1f4854' : '#7a9aa7' }} />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
