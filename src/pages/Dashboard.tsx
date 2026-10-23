import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  CheckCircle,
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  PhoneOff,
  Info,
  Zap,
  CheckCircle2,
  TrendingUp,
  Search,
  Phone,
  BookOpen,
  StickyNote,
  ArrowRight,
  Trash2,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Calendar,
  Filter,
  Share2,
  ChevronDown,
  FileText,
  Mail,
  Handshake,
  Plus,
  Copy,
  Check
} from 'lucide-react';
import EnquiryCard from '../components/EnquiryCard';
import { SALES_STAGE_THEME, formatRelativeDue } from './SalesNotes';
import {
  getLocalEnquiries,
  getLocalCourses,
  getLocalCategories,
  updateLocalEnquiry,
  getCurrentUserSession,
  getLocalNotes,
  syncLocalSalesNotes,
  saveLocalNote,
  updateLocalNote,
  deleteLocalNote,
  resolveNoteStage,
  resolveNoteCategories,
  NOTE_STAGES,
  SALES_FLOW_STAGES,
  type Enquiry,
  type Course,
  type Category,
  type UserSession,
  type Note,
  type NoteStage,
  type SalesWorkstreamCategory,
  WORKSTREAM_CATEGORIES
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const getNoteDateString = (note: Note): string => {
  if (note.timestamp) {
    const raw = String(note.timestamp);
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  if (note.reminderDate) {
    const rawRem = String(note.reminderDate);
    const m = rawRem.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  return '';
};

export const noteMatchesDate = (note: Note, dateVal: string): boolean => {
  if (!dateVal) return false;
  const dStr = getNoteDateString(note);
  if (dStr === dateVal) return true;
  if (note.timestamp) {
    const d = new Date(note.timestamp);
    if (!isNaN(d.getTime())) {
      const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (localStr === dateVal) return true;
    }
  }
  return false;
};

export const formatFilterDateLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return dateStr;
};

interface DashboardProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateToLead?: (prefillName?: string) => void;
  currentUser?: UserSession | null;
  onNavigateTab?: (tab: string) => void;
  searchQuery?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate,
  onNavigateToLead,
  currentUser,
  onNavigateTab,
  searchQuery
}) => {
  const user = currentUser || getCurrentUserSession();
  const isSales = user?.role === 'sales';

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Edit Modal State
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // User input for dynamic reminder reschedule interval (in days)
  const [reminderDays, setReminderDays] = useState<number>(2);

  // Last run timestamp for cron job simulator
  const [lastRunText, setLastRunText] = useState<string>('not run in this session');

  // Leads needing action filter
  const [actionFilter, setActionFilter] = useState<'all' | 'unreachable' | 'pending'>('all');

  // Sales notes state for Sales Dashboard preview
  const [salesNotes, setSalesNotes] = useState<Note[]>(() => getLocalNotes('sales'));
  const [notesStageFilter, setNotesStageFilter] = useState<string>('all');
  const [salesCategoryFilter, setSalesCategoryFilter] = useState<'all' | SalesWorkstreamCategory>('all');
  const [salesDateFilter, setSalesDateFilter] = useState<'all' | 'exact' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('all');
  const [salesExactDate, setSalesExactDate] = useState<string>('');
  const [salesCustomStartDate, setSalesCustomStartDate] = useState<string>('');
  const [salesCustomEndDate, setSalesCustomEndDate] = useState<string>('');
  const [showSalesDateRangeInputs, setShowSalesDateRangeInputs] = useState<boolean>(false);
  const [salesSearchText, setSalesSearchText] = useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [dropdownCustomStart, setDropdownCustomStart] = useState<string>('');
  const [dropdownCustomEnd, setDropdownCustomEnd] = useState<string>('');
  const [salesNotesCurrentPage, setSalesNotesCurrentPage] = useState<number>(1);
  const [salesNotesRowsPerPage, setSalesNotesRowsPerPage] = useState<number>(10);
  const [editingSalesNote, setEditingSalesNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showAddSalesNoteModal, setShowAddSalesNoteModal] = useState<boolean>(false);
  const [newSalesNoteContent, setNewSalesNoteContent] = useState<string>('');
  const [newSalesNoteStage, setNewSalesNoteStage] = useState<NoteStage | ''>('');
  const [newSalesNoteCategory, setNewSalesNoteCategory] = useState<SalesWorkstreamCategory | ''>('');
  const [newSalesNoteReminder, setNewSalesNoteReminder] = useState<string>('');
  const [isSavingNewSalesNote, setIsSavingNewSalesNote] = useState<boolean>(false);
  const [isRefreshingSalesNotes, setIsRefreshingSalesNotes] = useState(false);
  const [isRefreshingLeads, setIsRefreshingLeads] = useState(false);

  const handleOpenEditSalesNoteModal = (note: Note) => {
    const categories = resolveNoteCategories(note);
    const resolvedCategory = (note.category && note.category !== 'null' && note.category !== 'None')
      ? (note.category as SalesWorkstreamCategory)
      : (categories[0] || undefined);
    const resolvedStage = resolveNoteStage(note) || (note.stage && note.stage !== 'null' && note.stage !== 'None' ? (note.stage as NoteStage) : undefined);

    setEditingSalesNote({
      ...note,
      category: resolvedCategory,
      stage: resolvedStage
    });
  };

  // Overview metric cards modal and filter state
  const [activeCardModalKey, setActiveCardModalKey] = useState<'unresolved' | 'due' | 'total' | 'fee_shared' | 'not_reachable' | null>(null);
  const [cardModalSearch, setCardModalSearch] = useState<string>('');
  const [cardModalStageFilter, setCardModalStageFilter] = useState<string>('all');
  const [overviewCardFilter, setOverviewCardFilter] = useState<'unresolved' | 'due' | 'total' | 'fee_shared' | 'not_reachable' | 'all'>('all');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  const handleRefreshSalesNotes = async () => {
    setIsRefreshingSalesNotes(true);
    try {
      await fetchSalesNotes();
      showToast('Sales notes table refreshed from database!', 'success');
    } catch {
      showToast('Failed to refresh sales notes', 'error');
    } finally {
      setTimeout(() => setIsRefreshingSalesNotes(false), 500);
    }
  };

  const handleRefreshLeads = async () => {
    setIsRefreshingLeads(true);
    try {
      await fetchDashboardData();
      showToast('Leads table refreshed from database!', 'success');
    } catch {
      showToast('Failed to refresh leads table', 'error');
    } finally {
      setTimeout(() => setIsRefreshingLeads(false), 500);
    }
  };

  const fetchSalesNotes = async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('role', 'sales')
          .order('timestamp', { ascending: false });
        if (!error && data) {
          // Strictly isolate sales notes from any admin notes and filter out fake dummy notes
          const strictlySales = (data as Note[]).filter(
            n => n.role === 'sales' && n.created_by !== 'Admin' && !String(n.id).startsWith('sales-note-today-')
          );
          if (strictlySales.length > 0) {
            syncLocalSalesNotes(strictlySales);
            setSalesNotes(getLocalNotes('sales'));
            return;
          }
        }
      } catch (err) {
        console.error('Error loading sales notes from DB:', err);
      }
    }
    const local = getLocalNotes('sales').filter(
      n => n.role === 'sales' && n.created_by !== 'Admin' && !String(n.id).startsWith('sales-note-today-')
    );
    setSalesNotes(local);
  };

  const handleAddSalesNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalesNoteContent.trim()) return;

    setIsSavingNewSalesNote(true);
    const noteId = 'sales-note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const nowIso = new Date().toISOString();
    const hasStage = Boolean(newSalesNoteStage && String(newSalesNoteStage) !== 'null' && String(newSalesNoteStage) !== 'None');
    const finalStage = hasStage ? (newSalesNoteStage as NoteStage) : undefined;
    const hasCategory = Boolean(newSalesNoteCategory && String(newSalesNoteCategory) !== 'null' && String(newSalesNoteCategory) !== 'None');
    const finalCategory = hasCategory ? (newSalesNoteCategory as SalesWorkstreamCategory) : undefined;
    const isConverted = finalStage === 'Customer Onboarding' || finalStage === 'Converted' || finalStage === 'Partnership Followup';
    const finalActionItem = finalCategory ? `Workstream: ${finalCategory}` : (finalStage || undefined);

    const notePayload: Note = {
      id: noteId,
      content: newSalesNoteContent.trim(),
      role: 'sales',
      created_by: user?.name || 'Sales Desk',
      stage: finalStage,
      action_item: finalActionItem,
      category: finalCategory,
      reminderDate: newSalesNoteReminder || undefined,
      is_completed: isConverted,
      timestamp: nowIso
    };

    if (supabase) {
      try {
        await supabase.from('notes').insert([{
          id: notePayload.id,
          content: notePayload.content,
          role: 'sales',
          stage: finalStage || null,
          action_item: finalActionItem || null,
          is_completed: isConverted,
          created_by: notePayload.created_by,
          reminderDate: notePayload.reminderDate || null,
          timestamp: notePayload.timestamp
        }]);
      } catch (err) {
        console.error('Error inserting sales note in Supabase:', err);
      }
    }

    // Save note via saveLocalNote (which saves locally and syncs to Supabase)
    saveLocalNote(notePayload, 'sales');

    await fetchSalesNotes();
    setNewSalesNoteContent('');
    setNewSalesNoteReminder('');
    setNewSalesNoteStage('');
    setNewSalesNoteCategory('');
    setShowAddSalesNoteModal(false);
    setIsSavingNewSalesNote(false);
    
    // Reset filters so the newly added note is immediately visible in the ledger
    setSalesDateFilter('all');
    setNotesStageFilter('all');
    setSalesCategoryFilter('all');
    setSalesSearchText('');
    setSalesNotesCurrentPage(1);

    showToast('Sales note added to Sales Dashboard successfully!', 'success');
    onUpdate();
  };

  const handleDeleteSalesNote = async (id: string) => {
    if (supabase) {
      try {
        await supabase.from('notes').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting sales note from DB:', err);
      }
    }
    deleteLocalNote(id, 'sales');
    await fetchSalesNotes();
    if (editingSalesNote && String(editingSalesNote.id) === String(id)) {
      setEditingSalesNote(null);
    }
    setNoteToDelete(null);
    showToast('Sales note deleted successfully.', 'info');
    onUpdate();
  };

  const handleSaveEditSalesNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalesNote) return;

    const hasStage = Boolean(editingSalesNote.stage && editingSalesNote.stage !== 'null' && editingSalesNote.stage !== 'None' && String(editingSalesNote.stage).trim() !== '');
    const finalStage = hasStage ? (editingSalesNote.stage as NoteStage) : undefined;
    const catCandidate = editingSalesNote.category || resolveNoteCategories(editingSalesNote)[0];
    const hasCategory = Boolean(catCandidate && catCandidate !== 'null' && catCandidate !== 'None' && String(catCandidate).trim() !== '');
    const finalCategory = hasCategory ? (catCandidate as SalesWorkstreamCategory) : undefined;
    const finalActionItem = finalCategory ? `Workstream: ${finalCategory}` : (finalStage || null);

    const isCompleted = Boolean(finalStage === 'Customer Onboarding' || finalStage === 'Converted' || finalStage === 'Partnership Followup' || editingSalesNote.is_completed);

    if (supabase) {
      try {
        const { error: updateError } = await supabase.from('notes').update({
          content: editingSalesNote.content.trim(),
          stage: finalStage || null,
          action_item: finalActionItem,
          reminderDate: editingSalesNote.reminderDate || null,
          is_completed: isCompleted
        }).eq('id', editingSalesNote.id);
        if (updateError) {
          console.error('Error updating sales note in Supabase:', updateError);
        }
      } catch (err) {
        console.error('Error updating sales note in DB:', err);
      }
    }

    updateLocalNote(editingSalesNote.id, {
      content: editingSalesNote.content.trim(),
      stage: finalStage,
      action_item: finalActionItem || undefined,
      category: finalCategory,
      reminderDate: editingSalesNote.reminderDate || undefined,
      is_completed: isCompleted
    }, 'sales');

    await fetchSalesNotes();
    setEditingSalesNote(null);
    showToast('Sales note updated successfully!', 'success');
    onUpdate();
  };

  useEffect(() => {
    fetchSalesNotes();
    const handleNotesUpdate = () => fetchSalesNotes();
    window.addEventListener('sales-notes-updated', handleNotesUpdate);
    window.addEventListener('storage', handleNotesUpdate);
    window.addEventListener('focus', handleNotesUpdate);
    return () => {
      window.removeEventListener('sales-notes-updated', handleNotesUpdate);
      window.removeEventListener('storage', handleNotesUpdate);
      window.removeEventListener('focus', handleNotesUpdate);
    };
  }, [isSales, refreshTrigger, currentUser]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#sales-filter-dropdown-container')) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('click', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showFilterDropdown]);

  const fetchDashboardData = async () => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: cats } = await supabase.from('categories').select('*');
        const { data: crs } = await supabase.from('courses').select('*');
        const { data: enqs } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });

        if (cats) setCategories(cats);
        if (crs) setCourses(crs);
        if (enqs) setEnquiries(enqs);
      } catch (err) {
        console.error('Supabase query failed, using local storage:', err);
        loadLocalData();
      }
    } else {
      loadLocalData();
    }
  };

  const loadLocalData = () => {
    setCategories(getLocalCategories());
    setCourses(getLocalCourses());
    const enqs = getLocalEnquiries();
    const sorted = [...enqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEnquiries(sorted);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isDemo, refreshTrigger, currentUser]);

  // Simulating the Supabase Cron Job Reminder checker
  const handleTriggerReminders = () => {
    const now = new Date();
    const dueEnquiries = enquiries.filter(e => {
      const isUnresolved = e.interested === null || e.follow_up_done === null || e.can_follow_up === null;
      const isDue = new Date(e.next_reminder_at) <= now;
      return isUnresolved && isDue;
    });

    if (dueEnquiries.length === 0) {
      showToast('All reminders are up-to-date! No enquiries are due for reminders.', 'info');
      return;
    }

    dueEnquiries.forEach(e => {
      const newReminder = new Date();
      newReminder.setDate(now.getDate() + reminderDays);

      if (!isDemo && isSupabaseConfigured() && supabase) {
        supabase.from('enquiries').update({
          next_reminder_at: newReminder.toISOString(),
          last_reminded_at: now.toISOString(),
          updated_at: now.toISOString()
        }).eq('id', e.id);
      } else {
        updateLocalEnquiry(e.id, {
          next_reminder_at: newReminder.toISOString(),
          last_reminded_at: now.toISOString()
        });
      }
    });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastRunText(`Last run at ${timeStr}`);
    showToast(`Cron Job completed: Rescheduled ${dueEnquiries.length} reminders (+${reminderDays} days).`, 'success');

    setTimeout(() => {
      fetchDashboardData();
    }, 500);
  };

  const handleToggleStatus = (
    enquiry: Enquiry,
    field: 'interested' | 'follow_up_done' | 'can_follow_up',
    currentVal: boolean | null
  ) => {
    const nextVal = currentVal === null ? true : currentVal === true ? false : null;
    if (!isDemo && isSupabaseConfigured() && supabase) {
      supabase.from('enquiries').update({
        [field]: nextVal,
        updated_at: new Date().toISOString()
      }).eq('id', enquiry.id);
    }
    updateLocalEnquiry(enquiry.id, { [field]: nextVal });
    fetchDashboardData();
    onUpdate();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnquiry) return;

    setIsSavingEdit(true);

    try {
      if (!isDemo && isSupabaseConfigured() && supabase) {
        const updatePayload: any = {
          contact_name: editingEnquiry.contact_name,
          contact_phone: editingEnquiry.contact_phone || null,
          course_id: editingEnquiry.course_id,
          category_id: editingEnquiry.category_id,
          fee_shared: editingEnquiry.fee_shared,
          payment: editingEnquiry.payment,
          notes: editingEnquiry.notes || null,
          interested: editingEnquiry.interested,
          follow_up_done: editingEnquiry.follow_up_done,
          can_follow_up: editingEnquiry.can_follow_up,
          next_reminder_at: editingEnquiry.next_reminder_at,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('enquiries')
          .update(updatePayload)
          .eq('id', editingEnquiry.id);

        if (error) {
          if (error.message?.includes('payment') || error.code === 'PGRST204') {
            const { payment: _, ...fallbackPayload } = updatePayload;
            const { error: fallbackError } = await supabase
              .from('enquiries')
              .update(fallbackPayload)
              .eq('id', editingEnquiry.id);
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
      } else {
        updateLocalEnquiry(editingEnquiry.id, {
          contact_name: editingEnquiry.contact_name,
          contact_phone: editingEnquiry.contact_phone || '',
          course_id: editingEnquiry.course_id,
          category_id: editingEnquiry.category_id,
          fee_shared: editingEnquiry.fee_shared,
          payment: editingEnquiry.payment,
          notes: editingEnquiry.notes || '',
          interested: editingEnquiry.interested,
          follow_up_done: editingEnquiry.follow_up_done,
          can_follow_up: editingEnquiry.can_follow_up,
          next_reminder_at: editingEnquiry.next_reminder_at
        });
      }

      setEditingEnquiry(null);
      fetchDashboardData();
      onUpdate();
    } catch (err: any) {
      showToast(`Failed to save changes: ${err.message || err}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 1. Unresolved leads
  const unresolvedEnquiries = enquiries
    .filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 2. Reminders due
  const dueReminderCount = enquiries.filter(e => {
    const isUnresolved = e.interested === null || e.follow_up_done === null || e.can_follow_up === null;
    return isUnresolved && new Date(e.next_reminder_at) <= new Date();
  }).length;

  // 3. Fee shared
  const feeSharedCount = enquiries.filter(e => e.fee_shared).length;

  // 4. Not reachable
  const notReachableCount = enquiries.filter(e => e.can_follow_up === false).length;

  // 5. Follow up pending
  const followUpPendingCount = enquiries.filter(e => e.follow_up_done === null).length;

  // 6. Lead resolution counts
  const totalEnquiriesCount = enquiries.length || 1;
  const resolvedCount = enquiries.filter(e => e.interested !== null && e.follow_up_done !== null && e.can_follow_up !== null).length;
  const resolvedPercent = Math.round((resolvedCount / totalEnquiriesCount) * 100);

  // Division breakdown (Admin only)
  const academyCategory = categories.find(c => c.name.toLowerCase().includes('academy'));
  const techCategory = categories.find(c => c.name.toLowerCase().includes('tech'));
  const academyCount = enquiries.filter(e => academyCategory && e.category_id === academyCategory.id).length;
  const techCount = enquiries.filter(e => techCategory && e.category_id === techCategory.id).length;
  const totalDiv = (academyCount + techCount) || 1;
  const techPercent = Math.round((techCount / totalDiv) * 100);
  const academyPercent = 100 - techPercent;

  // Top courses by interest (Admin only)
  const courseInterestCounts = courses
    .map(c => ({
      name: c.name,
      count: enquiries.filter(e => e.course_id === c.id).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const maxCourseCount = Math.max(...courseInterestCounts.map(c => c.count), 1);

  // Sales-specific note-driven metrics (for Sales role based on salesNotes)
  const todayDateStr = new Date().toISOString().split('T')[0];
  const salesTotalCount = salesNotes.length;
  const isCompletedStage = (stg: string | null) => Boolean(stg && (stg === 'Customer Onboarding' || stg === 'Converted'));
  const isConvertedNote = (n: Note) => Boolean(n.is_completed || isCompletedStage(resolveNoteStage(n)) || n.stage === 'Converted' || n.stage === 'Customer Onboarding' || n.action_item === 'Converted');
  const salesUnresolvedCount = salesNotes.filter(n => !isConvertedNote(n)).length;
  const salesDueReminderCount = salesNotes.filter(n => Boolean(n.reminderDate && n.reminderDate <= todayDateStr && !isConvertedNote(n))).length;
  const salesFeeCount = salesNotes.filter(n => resolveNoteStage(n) === 'Estimation' || resolveNoteStage(n) === 'Proposal').length;
  const salesNotReachableCount = salesNotes.filter(n => Boolean(n.reminderDate && n.reminderDate < todayDateStr && !isConvertedNote(n))).length;
  const salesResolvedCount = salesNotes.filter(n => isConvertedNote(n)).length;
  const salesResolvedPercent = salesTotalCount > 0 ? Math.round((salesResolvedCount / salesTotalCount) * 100) : 0;
  const salesFollowupsCompletedCount = salesNotes.filter(n => isConvertedNote(n) || resolveNoteStage(n) === 'Proposal').length;

  type OverviewCardKey = 'unresolved' | 'due' | 'total' | 'fee_shared' | 'not_reachable';

  const OVERVIEW_CARD_CONFIG: Record<OverviewCardKey, {
    title: string;
    description: string;
    icon: any;
    color: string;
    bg: string;
    borderColor: string;
  }> = {
    unresolved: {
      title: 'Unresolved Leads',
      description: isSales
        ? 'Active sales leads & discussion notes pending follow-up (includes Lead Generation)'
        : 'Open customer enquiries pending qualification or follow-up action',
      icon: Package,
      color: '#1ba37c',
      bg: 'rgba(27, 163, 124, 0.12)',
      borderColor: 'rgba(27, 163, 124, 0.35)'
    },
    due: {
      title: 'Reminders Due',
      description: isSales
        ? 'Scheduled sales follow-ups and client reminders due today or overdue'
        : 'Student enquiries with scheduled reminder alarms due for outreach',
      icon: Bell,
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.12)',
      borderColor: 'rgba(2, 132, 199, 0.35)'
    },
    total: {
      title: 'Total Leads',
      description: isSales
        ? 'All client leads and activity notes recorded in the sales system'
        : 'Complete ledger of all enquiries logged in the system',
      icon: TrendingUp,
      color: '#477987',
      bg: 'rgba(71, 121, 135, 0.15)',
      borderColor: 'rgba(71, 121, 135, 0.35)'
    },
    fee_shared: {
      title: 'Fee Shared / Proposal',
      description: isSales
        ? 'Sales leads with estimation, fee details, or partnership proposal shared'
        : 'Enquiries where course fee details and payment info have been shared',
      icon: CheckCircle2,
      color: '#1ba37c',
      bg: 'rgba(27, 163, 124, 0.15)',
      borderColor: 'rgba(27, 163, 124, 0.35)'
    },
    not_reachable: {
      title: 'Not Reachable / Overdue',
      description: isSales
        ? 'Sales leads with past-due reminders requiring re-outreach or follow-up'
        : 'Leads flagged as unreachable or unable to follow up',
      icon: PhoneOff,
      color: '#ea580c',
      bg: 'rgba(234, 88, 12, 0.15)',
      borderColor: 'rgba(234, 88, 12, 0.35)'
    }
  };

  const getSalesCardNotes = (key: OverviewCardKey): Note[] => {
    switch (key) {
      case 'unresolved':
        return salesNotes.filter(n => !isConvertedNote(n));
      case 'due':
        return salesNotes.filter(n => Boolean(n.reminderDate && n.reminderDate <= todayDateStr && !isConvertedNote(n)));
      case 'total':
        return salesNotes;
      case 'fee_shared':
        return salesNotes.filter(n => resolveNoteStage(n) === 'Estimation' || resolveNoteStage(n) === 'Proposal');
      case 'not_reachable':
        return salesNotes.filter(n => Boolean(n.reminderDate && n.reminderDate < todayDateStr && !isConvertedNote(n)));
      default:
        return salesNotes;
    }
  };

  const getAdminCardEnquiries = (key: OverviewCardKey): Enquiry[] => {
    switch (key) {
      case 'unresolved':
        return unresolvedEnquiries;
      case 'due':
        return enquiries.filter(e => {
          const isUnresolved = e.interested === null || e.follow_up_done === null || e.can_follow_up === null;
          return isUnresolved && new Date(e.next_reminder_at) <= new Date();
        });
      case 'total':
        return enquiries;
      case 'fee_shared':
        return enquiries.filter(e => Boolean(e.fee_shared));
      case 'not_reachable':
        return enquiries.filter(e => e.can_follow_up === false);
      default:
        return enquiries;
    }
  };

  const handleCardClick = (key: OverviewCardKey) => {
    setActiveCardModalKey(key);
    setCardModalSearch('');
    setCardModalStageFilter('all');
    setOverviewCardFilter(key);
    // Reset conflicting stage, category, date, and search filters so all records for this card (e.g. all 46 unresolved leads) are shown
    setNotesStageFilter('all');
    setSalesCategoryFilter('all');
    setSalesDateFilter('all');
    setSalesExactDate('');
    setSalesCustomStartDate('');
    setSalesCustomEndDate('');
    setShowSalesDateRangeInputs(false);
    setSalesSearchText('');
    setSalesNotesCurrentPage(1);
    setCurrentPage(1);
  };

  const handleToggleSalesNoteComplete = async (note: Note) => {
    const nextCompleted = !note.is_completed;
    if (supabase) {
      try {
        await supabase.from('notes').update({
          is_completed: nextCompleted
        }).eq('id', note.id);
      } catch (err) {
        console.error('Error toggling sales note completion:', err);
      }
    }
    updateLocalNote(note.id, { is_completed: nextCompleted }, 'sales');
    await fetchSalesNotes();
    onUpdate();
    showToast(nextCompleted ? 'Marked as completed / resolved!' : 'Marked as pending / unresolved.', 'success');
  };

  const handleCopyNoteContent = async (note: Note) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopiedNoteId(note.id);
      showToast('Note content copied to clipboard!', 'success');
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch {
      showToast('Failed to copy note content', 'error');
    }
  };

  // Date matching helper for Sales Notes
  const matchesSalesDateFilter = (note: Note): boolean => {
    if (salesDateFilter === 'all') return true;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const noteDateStr = getNoteDateString(note);

    if (salesDateFilter === 'exact') {
      if (!salesExactDate) return true;
      return noteMatchesDate(note, salesExactDate);
    }

    if (salesDateFilter === 'today') {
      return noteDateStr === todayStr;
    }

    if (salesDateFilter === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterdayStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      return noteDateStr === yesterdayStr;
    }

    if (salesDateFilter === 'last7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      return Boolean(noteDateStr) && noteDateStr >= pastStr && noteDateStr <= todayStr;
    }

    if (salesDateFilter === 'thisMonth') {
      const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      return Boolean(noteDateStr) && noteDateStr.startsWith(monthPrefix);
    }

    if (salesDateFilter === 'custom') {
      if (!salesCustomStartDate && !salesCustomEndDate) return true;
      return Boolean(noteDateStr) &&
        (!salesCustomStartDate || noteDateStr >= salesCustomStartDate) &&
        (!salesCustomEndDate || noteDateStr <= salesCustomEndDate);
    }

    return true;
  };

  // Active sales notes to feed the pipeline flow (scoped to active date filter if selected)
  const activePipelineNotes = useMemo(() => {
    return salesNotes.filter(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return false;
      return matchesSalesDateFilter(n);
    });
  }, [salesNotes, salesDateFilter, salesExactDate, salesCustomStartDate, salesCustomEndDate]);

  const salesPipelineStages = SALES_FLOW_STAGES.map(stageName => ({
    name: stageName,
    count: activePipelineNotes.filter(n => resolveNoteStage(n) === stageName).length
  }));
  const maxSalesPipelineStageCount = Math.max(...salesPipelineStages.map(s => s.count), 1);
  const activePipelineTotalCount = activePipelineNotes.length;
  const activePipelineCompletedCount = activePipelineNotes.filter(n => n.is_completed || resolveNoteStage(n) === 'Customer Onboarding' || resolveNoteStage(n) === 'Proposal').length;
  const salesOnboardingCount = salesNotes.filter(n => isCompletedStage(resolveNoteStage(n)) || n.is_completed).length;

  const handleSelectPipelineStage = (stageName: string) => {
    const next = notesStageFilter === stageName ? 'all' : stageName;
    setNotesStageFilter(next);
    setSalesCategoryFilter('all');
    setSalesNotesCurrentPage(1);
    const targetSection = document.getElementById('recent-sales-notes-section');
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Unique dates present in sales desk ledger for dynamic date-wise filter pills
  const uniqueSalesDates = useMemo(() => {
    const map = new Map<string, number>();
    salesNotes.forEach(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return;
      const dStr = getNoteDateString(n);
      if (dStr) {
        map.set(dStr, (map.get(dStr) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({ date, count }));
  }, [salesNotes]);

  // Filtered sales notes list for Sales Dashboard Ledger
  const filteredSalesNotes = salesNotes
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter(n => {
      // Strictly isolate sales dashboard from any admin records
      if (n.role === 'admin' || n.created_by === 'Admin') {
        return false;
      }
      // Overview card filter (Unresolved, Due reminders, Fee shared, etc.)
      if (overviewCardFilter !== 'all') {
        if (overviewCardFilter === 'unresolved' && (n.is_completed || isCompletedStage(resolveNoteStage(n)))) {
          return false;
        }
        if (overviewCardFilter === 'due' && (!n.reminderDate || n.reminderDate > todayDateStr || n.is_completed)) {
          return false;
        }
        if (overviewCardFilter === 'fee_shared') {
          const stg = resolveNoteStage(n);
          if (stg !== 'Estimation' && stg !== 'Proposal') return false;
        }
        if (overviewCardFilter === 'not_reachable' && (!n.reminderDate || n.reminderDate >= todayDateStr || n.is_completed)) {
          return false;
        }
      }
      // Workstream category filter (Cold Emails, Partnership, Research)
      if (salesCategoryFilter !== 'all') {
        const cats = resolveNoteCategories(n);
        if (!cats.includes(salesCategoryFilter)) {
          return false;
        }
      }
      // Stage filter
      if (notesStageFilter !== 'all' && resolveNoteStage(n) !== notesStageFilter) {
        return false;
      }
      // Date filter
      if (!matchesSalesDateFilter(n)) {
        return false;
      }
      // Text search filter
      const q = (salesSearchText || searchQuery || '').trim().toLowerCase();
      if (q) {
        const cMatch = (n.content || '').toLowerCase().includes(q);
        const sMatch = (n.stage || n.action_item || '').toLowerCase().includes(q);
        const uMatch = (n.created_by || '').toLowerCase().includes(q);
        if (!cMatch && !sMatch && !uMatch) return false;
      }
      return true;
    });

  // Calculate workstream category counts strictly for sales notes
  const activeSalesNotes = salesNotes.filter(n => n.role !== 'admin' && n.created_by !== 'Admin');
  const coldEmailsCount = activeSalesNotes.filter(n => resolveNoteCategories(n).includes('Cold Emails')).length;
  const partnershipCount = activeSalesNotes.filter(n => resolveNoteCategories(n).includes('Partnership')).length;
  const researchCount = activeSalesNotes.filter(n => resolveNoteCategories(n).includes('Research')).length;

  // Calculate today's sales updates count
  const salesTodayUpdates = salesNotes.filter(n => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const d = n.timestamp ? new Date(n.timestamp) : null;
    const dStr = d && !isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : '';
    return dStr === todayStr || n.reminderDate === todayStr;
  });
  const salesTodayUpdatesCount = salesTodayUpdates.length;

  // Export filtered notes to Microsoft Excel (.xls XML spreadsheet with full formatting)
  const handleExportSalesNotesToExcel = (notesToExport = filteredSalesNotes, customFilterName?: string) => {
    if (notesToExport.length === 0) {
      showToast('No sales notes found for the current filter to export.', 'info');
      return;
    }

    const sanitize = (val: any) =>
      String(val || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const filterName = customFilterName || (
      salesDateFilter === 'exact' ? `${formatFilterDateLabel(salesExactDate)} Updates` :
      salesDateFilter === 'today' ? "Today's Updates" :
      salesDateFilter === 'yesterday' ? "Yesterday's Updates" :
      salesDateFilter === 'last7' ? "Last 7 Days Updates" :
      salesDateFilter === 'thisMonth' ? "This Month's Updates" :
      salesDateFilter === 'custom' ? `Custom Range (${salesCustomStartDate || 'start'} to ${salesCustomEndDate || 'today'})` :
      notesStageFilter !== 'all' ? `${notesStageFilter} Stage` :
      "All Notes"
    );

    const nowFormatted = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const rowsXml = notesToExport.map((n, idx) => {
      const stage = resolveNoteStage(n);
      const dateFormatted = n.timestamp
        ? new Date(n.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : 'N/A';
      const reminderFormatted = n.reminderDate
        ? new Date(n.reminderDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : 'None';
      const status = n.is_completed ? 'Completed' : 'Pending Follow-up';

      return `
   <Row ss:AutoFitHeight="1">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellDate"><Data ss:Type="String">${sanitize(dateFormatted)}</Data></Cell>
    <Cell ss:StyleID="CellStage"><Data ss:Type="String">${sanitize(stage)}</Data></Cell>
    <Cell ss:StyleID="CellWrap"><Data ss:Type="String">${sanitize(n.content)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${sanitize(n.action_item || stage)}</Data></Cell>
    <Cell ss:StyleID="CellDate"><Data ss:Type="String">${sanitize(reminderFormatted)}</Data></Cell>
    <Cell ss:StyleID="CellStatus"><Data ss:Type="String">${sanitize(status)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${sanitize(n.created_by || 'Sales Desk')}</Data></Cell>
   </Row>`;
    }).join('');

    const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Color="#1F4854" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#64748B" ss:Italic="1"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F766E"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1F4854" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5"/>
  </Style>
  <Style ss:ID="CellDate">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F766E" ss:Bold="1"/>
  </Style>
  <Style ss:ID="CellStage">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellWrap">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5"/>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5"/>
  </Style>
  <Style ss:ID="CellStatus">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Sales Updates Ledger">
  <Table>
   <Column ss:Width="35"/>
   <Column ss:Width="135"/>
   <Column ss:Width="140"/>
   <Column ss:Width="380"/>
   <Column ss:Width="130"/>
   <Column ss:Width="105"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="7" ss:StyleID="Title"><Data ss:Type="String">GLOBAL MINDS TECHNOLOGIES - SALES UPDATES REPORT</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="7" ss:StyleID="Subtitle"><Data ss:Type="String">Filter: ${sanitize(filterName)}  |  Generated: ${nowFormatted}  |  Total Records: ${notesToExport.length}  |  Prepared By: Sales Desk</Data></Cell>
   </Row>
   <Row ss:Height="10"/>
   <Row ss:Height="26" ss:StyleID="Header">
    <Cell><Data ss:Type="String">#</Data></Cell>
    <Cell><Data ss:Type="String">Date &amp; Time</Data></Cell>
    <Cell><Data ss:Type="String">Pipeline Stage</Data></Cell>
    <Cell><Data ss:Type="String">Activity / Note Content</Data></Cell>
    <Cell><Data ss:Type="String">Action Item</Data></Cell>
    <Cell><Data ss:Type="String">Reminder Due</Data></Cell>
    <Cell><Data ss:Type="String">Status</Data></Cell>
    <Cell><Data ss:Type="String">Logged By</Data></Cell>
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const today = new Date();
    const dateSlug = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const slug = filterName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
    const fileName = `GlobalMinds_Sales_${slug}_${dateSlug}.xls`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${notesToExport.length} sales ${notesToExport.length === 1 ? 'update' : 'updates'} to Excel (${fileName})!`, 'success');
  };

  const handleExportCardNotes = (key: OverviewCardKey) => {
    const notes = getSalesCardNotes(key);
    const cfg = OVERVIEW_CARD_CONFIG[key];
    handleExportSalesNotesToExcel(notes, `${cfg.title} (${notes.length} records)`);
  };

  // Filter and export today's updates
  const handleFilterAndExportToday = () => {
    setSalesDateFilter('today');
    setSalesNotesCurrentPage(1);
    setShowFilterDropdown(false);
    if (salesTodayUpdates.length === 0) {
      showToast("No sales updates recorded for today yet. Filter applied to Today's view.", 'info');
      return;
    }
    handleExportSalesNotesToExcel(salesTodayUpdates, "Today's Updates");
  };

  // Apply custom date filter to on-screen ledger
  const handleApplyCustomFilter = (startDate: string, endDate: string) => {
    if (!startDate && !endDate) {
      showToast('Please choose at least a Start Date or End Date.', 'info');
      return;
    }
    setSalesCustomStartDate(startDate);
    setSalesCustomEndDate(endDate);
    setSalesDateFilter('custom');
    setSalesNotesCurrentPage(1);
    setShowFilterDropdown(false);
    showToast(`Custom date filter applied: ${startDate || 'Start'} to ${endDate || 'Today'}`, 'success');
  };

  // Filter and export custom date range
  const handleFilterAndExportCustom = (startDate: string, endDate: string) => {
    if (!startDate && !endDate) {
      showToast('Please choose at least a Start Date or End Date.', 'info');
      return;
    }
    setSalesCustomStartDate(startDate);
    setSalesCustomEndDate(endDate);
    setSalesDateFilter('custom');
    setSalesNotesCurrentPage(1);
    setShowFilterDropdown(false);

    const customNotes = salesNotes.filter(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return false;
      const d = n.timestamp ? new Date(n.timestamp) : null;
      const noteDateStr = d && !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : '';
      const reminderClean = n.reminderDate ? (n.reminderDate.length >= 10 ? n.reminderDate.slice(0, 10) : n.reminderDate) : '';
      const hasDateInRange = Boolean(noteDateStr) &&
        (!startDate || noteDateStr >= startDate) &&
        (!endDate || noteDateStr <= endDate);
      const hasReminderInRange = Boolean(reminderClean) &&
        (!startDate || reminderClean >= startDate) &&
        (!endDate || reminderClean <= endDate);
      return hasDateInRange || hasReminderInRange;
    });

    if (customNotes.length === 0) {
      showToast('No sales updates found for the selected date range. Filter applied.', 'info');
      return;
    }

    const rangeLabel = `Custom Range (${startDate || 'Start'} to ${endDate || 'Today'})`;
    handleExportSalesNotesToExcel(customNotes, rangeLabel);
  };

  // Filter by picked date from calendar and export immediately
  const handleFilterAndExportByDate = (dateVal: string) => {
    if (!dateVal) return;
    setSalesExactDate(dateVal);
    setSalesDateFilter('exact');
    setSalesNotesCurrentPage(1);
    setShowFilterDropdown(false);

    const matching = salesNotes.filter(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return false;
      return noteMatchesDate(n, dateVal);
    });

    if (matching.length > 0) {
      handleExportSalesNotesToExcel(matching, `${formatFilterDateLabel(dateVal)} Updates`);
    } else {
      showToast(`No sales updates recorded for ${formatFilterDateLabel(dateVal)}. Filter applied.`, 'info');
    }
  };

  // Clear date filter to show all
  const handleClearDateFilter = () => {
    setSalesDateFilter('all');
    setSalesExactDate('');
    setSalesCustomStartDate('');
    setSalesCustomEndDate('');
    setDropdownCustomStart('');
    setDropdownCustomEnd('');
    setShowSalesDateRangeInputs(false);
    setSalesNotesCurrentPage(1);
    setShowFilterDropdown(false);
    showToast('Date filter cleared. Showing all notes.', 'info');
  };

  // Quick export for today's updates only
  const handleExportTodayUpdates = () => {
    handleFilterAndExportToday();
  };

  // Export as CSV
  const handleExportSalesNotesToCsv = (notesToExport = filteredSalesNotes) => {
    if (notesToExport.length === 0) {
      showToast('No sales notes found for the current filter to export.', 'info');
      return;
    }

    const headers = ['#', 'Date & Time', 'Pipeline Stage', 'Activity / Note Content', 'Action Item', 'Reminder Due', 'Status', 'Logged By'];
    const rows = notesToExport.map((n, idx) => {
      const stage = resolveNoteStage(n);
      const dateFormatted = n.timestamp
        ? new Date(n.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : 'N/A';
      const reminderFormatted = n.reminderDate
        ? new Date(n.reminderDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : 'None';
      const status = n.is_completed ? 'Completed' : 'Pending Follow-up';

      return [
        idx + 1,
        `"${dateFormatted.replace(/"/g, '""')}"`,
        `"${(stage || '').replace(/"/g, '""')}"`,
        `"${(n.content || '').replace(/"/g, '""')}"`,
        `"${(n.action_item || stage || '').replace(/"/g, '""')}"`,
        `"${reminderFormatted.replace(/"/g, '""')}"`,
        `"${status.replace(/"/g, '""')}"`,
        `"${(n.created_by || 'Sales Desk').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const today = new Date();
    const dateSlug = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const fileName = `GlobalMinds_Sales_Updates_${dateSlug}.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${notesToExport.length} sales updates to CSV (${fileName})!`, 'success');
  };

  // Quick share / copy summary to share with colleagues or clients
  const handleShareSummary = async (notesToShare = filteredSalesNotes) => {
    if (notesToShare.length === 0) {
      showToast('No notes to share.', 'info');
      return;
    }

    const todayFormatted = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const filterLabel = salesDateFilter === 'today' ? "Today's Updates" : "Sales Updates";
    let text = `📊 *GLOBAL MINDS TECHNOLOGIES - ${filterLabel.toUpperCase()}* (${todayFormatted})\n`;
    text += `Total Records: ${notesToShare.length}\n`;
    text += `----------------------------------------------------\n\n`;

    notesToShare.forEach((n, idx) => {
      const stage = resolveNoteStage(n);
      const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      const reminder = n.reminderDate ? ` | Due: ${n.reminderDate}` : '';
      text += `${idx + 1}. [${stage}] ${timeStr ? '(' + timeStr + ')' : ''}\n`;
      text += `   ${n.content}\n`;
      text += `   Action: ${n.action_item || stage}${reminder} | Status: ${n.is_completed ? 'Completed' : 'Pending Follow-up'}\n\n`;
    });

    text += `Prepared by: Sales Desk · Global Minds`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Global Minds - ${filterLabel}`,
          text: text
        });
        showToast('Shared successfully!', 'success');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Fallback to clipboard
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('Updates summary copied to clipboard! Ready to paste & share.', 'success');
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Sales Pipeline Funnel Stages (Admin view)
  const totalLeads = enquiries.length;
  const leadGenCount = enquiries.filter(e => e.contact_phone || e.contact_name).length;
  const demoCount = enquiries.filter(e => (e.notes && e.notes.toLowerCase().includes('demo')) || e.interested === true).length;
  const reqGatheringCount = enquiries.filter(e => e.follow_up_done === true).length;
  const estimationCount = enquiries.filter(e => e.fee_shared === true || e.payment).length;
  const proposalCount = enquiries.filter(e => e.fee_shared === true).length;
  const onboardingCount = enquiries.filter(e => e.payment === 'Completed' || e.payment === 'Partially Paid' || (e.interested === true && e.follow_up_done === true)).length;

  const pipelineStages = [
    { name: 'Target Customer', count: totalLeads },
    { name: 'Lead Generation', count: leadGenCount },
    { name: 'Demo', count: demoCount },
    { name: 'Requirement Gathering', count: reqGatheringCount },
    { name: 'Estimation', count: estimationCount },
    { name: 'Proposal', count: proposalCount },
    { name: 'Customer Onboarding', count: onboardingCount }
  ];

  const maxPipelineStageCount = Math.max(...pipelineStages.map(s => s.count), 1);

  // Filtered action leads based on filter pills
  const filteredActionLeads = unresolvedEnquiries.filter(e => {
    if (actionFilter === 'unreachable') return e.can_follow_up === false;
    if (actionFilter === 'pending') return e.follow_up_done === null;
    return true;
  });

  const filteredAllEnquiries = enquiries
    .slice()
    .filter(e => {
      // Support overview card filter for Admin role
      if (overviewCardFilter !== 'all') {
        if (overviewCardFilter === 'unresolved' && (e.interested !== null && e.follow_up_done !== null && e.can_follow_up !== null)) return false;
        if (overviewCardFilter === 'due' && !(e.next_reminder_at && new Date(e.next_reminder_at) <= new Date())) return false;
        if (overviewCardFilter === 'fee_shared' && !e.fee_shared) return false;
        if (overviewCardFilter === 'not_reachable' && e.can_follow_up !== false) return false;
      }
      const q = (searchQuery || '').toLowerCase().trim();
      if (!q) return true;
      const c = courses.find(course => course.id === e.course_id);
      return e.contact_name.toLowerCase().includes(q) || 
             (e.contact_phone && e.contact_phone.includes(q)) || 
             (c && c.name.toLowerCase().includes(q)) ||
             (e.notes && e.notes.toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalPages = Math.ceil(filteredAllEnquiries.length / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedEnquiries = filteredAllEnquiries.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Toast Feedback Notification (Non-blocking) */}
      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: toastMessage.type === 'error' ? 'hsl(var(--danger) / 0.15)' : toastMessage.type === 'success' ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--primary) / 0.15)',
            border: `1px solid ${toastMessage.type === 'error' ? 'hsl(var(--danger))' : toastMessage.type === 'success' ? 'hsl(var(--success))' : 'hsl(var(--primary))'}`,
            color: toastMessage.type === 'error' ? 'hsl(var(--danger))' : toastMessage.type === 'success' ? 'hsl(var(--success))' : 'hsl(var(--primary))',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* Overview Section: Overall Leads Informations */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
              {isSales ? 'Sales Leads Overview' : 'Overall Leads Overview'}
            </h2>
            {overviewCardFilter !== 'all' && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: '#ccfbf1',
                  color: '#0f766e',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  border: '1px solid #99f6e4',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>Filtered by: {OVERVIEW_CARD_CONFIG[overviewCardFilter].title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setOverviewCardFilter('all');
                    setSalesNotesCurrentPage(1);
                  }}
                  style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', padding: 0, fontWeight: 800, fontSize: '12px' }}
                  title="Clear overview filter"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <span style={{ fontSize: '12.5px', color: '#5b7b88', fontWeight: 600 }}>
            {isSales ? salesTotalCount : enquiries.length} total leads recorded in system
          </span>
        </div>

        {/* 5 Overall Leads Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Card 1: Unresolved leads */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('unresolved')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick('unresolved'); }}
            className={`glass-card overview-metric-card ${overviewCardFilter === 'unresolved' ? 'active-card-filter' : ''}`}
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              border: overviewCardFilter === 'unresolved' ? '2px solid #1ba37c' : undefined
            }}
            title={`Click to view all ${isSales ? salesUnresolvedCount : unresolvedEnquiries.length} Unresolved leads notes`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box">
                <Package size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {isSales ? salesUnresolvedCount : unresolvedEnquiries.length}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Unresolved leads
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '11px', color: '#1ba37c', fontWeight: 700 }}>
              <span>Click to view {isSales ? salesUnresolvedCount : unresolvedEnquiries.length} {isSales ? 'notes' : 'leads'}</span>
              <ArrowRight size={13} />
            </div>
          </div>

          {/* Card 2: Reminders due */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('due')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick('due'); }}
            className={`glass-card overview-metric-card ${overviewCardFilter === 'due' ? 'active-card-filter' : ''}`}
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              border: overviewCardFilter === 'due' ? '2px solid #0284c7' : undefined
            }}
            title={`Click to view all ${isSales ? salesDueReminderCount : dueReminderCount} Reminders due notes`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box">
                <Bell size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {isSales ? salesDueReminderCount : dueReminderCount}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Reminders due
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '11px', color: '#1ba37c', fontWeight: 700 }}>
              <span>Click to view {isSales ? salesDueReminderCount : dueReminderCount} {isSales ? 'notes' : 'leads'}</span>
              <ArrowRight size={13} />
            </div>
          </div>

          {/* Card 3: Total Leads */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('total')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick('total'); }}
            className={`glass-card overview-metric-card ${overviewCardFilter === 'total' ? 'active-card-filter' : ''}`}
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              border: overviewCardFilter === 'total' ? '2px solid #477987' : undefined
            }}
            title={`Click to view all ${isSales ? salesTotalCount : enquiries.length} Total leads`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box" style={{ backgroundColor: 'rgba(71, 121, 135, 0.15)', color: '#477987' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {isSales ? salesTotalCount : enquiries.length}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Total leads
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '11px', color: '#477987', fontWeight: 700 }}>
              <span>Click to view all {isSales ? salesTotalCount : enquiries.length} {isSales ? 'notes' : 'leads'}</span>
              <ArrowRight size={13} />
            </div>
          </div>

          {/* Card 4: Fee Shared (Admin only; hidden on Sales dashboard) */}
          {!isSales && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick('fee_shared')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick('fee_shared'); }}
              className={`glass-card overview-metric-card ${overviewCardFilter === 'fee_shared' ? 'active-card-filter' : ''}`}
              style={{
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                border: overviewCardFilter === 'fee_shared' ? '2px solid #1ba37c' : undefined
              }}
              title={`Click to view all ${feeSharedCount} Fee shared leads`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="metric-icon-box" style={{ backgroundColor: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c' }}>
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                    {feeSharedCount}
                  </div>
                  <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                    Fee shared
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '11px', color: '#1ba37c', fontWeight: 700 }}>
                <span>Click to view {feeSharedCount} leads</span>
                <ArrowRight size={13} />
              </div>
            </div>
          )}

          {/* Card 5: Not reachable */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('not_reachable')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick('not_reachable'); }}
            className={`glass-card metric-card-peach overview-metric-card ${overviewCardFilter === 'not_reachable' ? 'active-card-filter' : ''}`}
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              border: overviewCardFilter === 'not_reachable' ? '2px solid #ea580c' : undefined
            }}
            title={`Click to view all ${isSales ? salesNotReachableCount : notReachableCount} Not reachable leads`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box">
                <PhoneOff size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {isSales ? salesNotReachableCount : notReachableCount}
                </div>
                <div style={{ fontSize: '13px', color: '#78350f', fontWeight: 600, marginTop: '3px' }}>
                  Not reachable
                </div>
              </div>
              <Info size={16} style={{ position: 'absolute', top: '14px', right: '14px', color: '#ea580c', opacity: 0.6 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(234, 88, 12, 0.15)', fontSize: '11px', color: '#c2410c', fontWeight: 700 }}>
              <span>Click to view {isSales ? salesNotReachableCount : notReachableCount} {isSales ? 'notes' : 'leads'}</span>
              <ArrowRight size={13} />
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row - Overall Leads & Sales Pipeline Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Card 1: Lead Resolution Status */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '22px 24px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', marginBottom: '6px' }}>
              Lead Resolution Status
            </h3>
            <p style={{ fontSize: '13px', color: '#5b7b88', lineHeight: 1.45, margin: '0 0 14px 0' }}>
              Overall progress of client lead qualification, outreach, and resolution.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '8px 0 16px 0' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#eef5f8" strokeWidth="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="#1ba37c"
                    strokeWidth="4"
                    strokeDasharray={`${salesResolvedPercent} ${100 - salesResolvedPercent}`}
                    strokeDashoffset="0"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#162e3b'
                  }}
                >
                  <span style={{ fontSize: '18px', color: '#1ba37c' }}>{salesResolvedPercent}%</span>
                  <span style={{ fontSize: '11px', color: '#7a9aa7' }}>Resolved</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eef4f7', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#1ba37c' }} />
              <span style={{ color: '#162e3b', fontWeight: 600 }}>Resolved enquiries</span>
              <span style={{ color: '#7a9aa7', marginLeft: 'auto' }}>{salesResolvedCount} leads</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ea580c' }} />
              <span style={{ color: '#162e3b', fontWeight: 600 }}>Follow-up pending</span>
              <span style={{ color: '#7a9aa7', marginLeft: 'auto' }}>{salesUnresolvedCount} leads</span>
            </div>
          </div>
        </div>

        {/* Card 2: Lead Engagement Breakdown */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '22px 24px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', marginBottom: '6px' }}>
              Lead Engagement Breakdown
            </h3>
            <p style={{ fontSize: '13px', color: '#5b7b88', lineHeight: 1.45, margin: '0 0 16px 0' }}>
              Client responsiveness, counseling follow-ups, and scheduled contact deadlines.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #eef4f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={16} style={{ color: '#1ba37c' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#162e3b' }}>Follow-ups Completed</span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#1ba37c' }}>{salesFollowupsCompletedCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #eef4f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TrendingUp size={16} style={{ color: '#0284c7' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#162e3b' }}>Proposals &amp; Estimations</span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7' }}>{salesFeeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #eef4f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Bell size={16} style={{ color: '#ea580c' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#162e3b' }}>Immediate Reminders Due</span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#ea580c' }}>{salesDueReminderCount}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#7a9aa7', borderTop: '1px solid #eef4f7', paddingTop: '10px', marginTop: '12px' }}>
            Reflecting active sales pipeline records
          </div>
        </div>

        {/* Card 3: Sales Pipeline Flow */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'hsl(var(--foreground))', margin: 0 }}>
                Sales Pipeline Flow
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {notesStageFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotesStageFilter('all');
                      setSalesNotesCurrentPage(1);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'hsl(var(--danger))',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Clear Filter
                  </button>
                )}
                <span style={{ fontSize: '12px', fontWeight: 700, color: salesDateFilter !== 'all' ? '#0f766e' : 'hsl(var(--muted))' }}>
                  {salesDateFilter !== 'all' && salesExactDate ? `${formatFilterDateLabel(salesExactDate)} (${activePipelineTotalCount} leads)` : `${activePipelineTotalCount} leads`}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px', lineHeight: 1.4, fontWeight: 500 }}>
              {SALES_FLOW_STAGES.join(' → ')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {salesPipelineStages.map((stageItem, idx) => {
                const barWidthPercent = stageItem.count > 0 
                  ? Math.max(12, Math.round((stageItem.count / maxSalesPipelineStageCount) * 100)) 
                  : 6;
                const isActiveStage = notesStageFilter === stageItem.name;
                const stageTheme = SALES_STAGE_THEME[stageItem.name] || SALES_STAGE_THEME['Target Customer'];

                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectPipelineStage(stageItem.name)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectPipelineStage(stageItem.name); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '12px',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isActiveStage ? stageTheme.bg : 'transparent',
                      border: isActiveStage ? `1.5px solid ${stageTheme.color}` : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Click to filter notes by ${stageItem.name} (${stageItem.count} leads)`}
                  >
                    <span
                      style={{
                        width: '185px',
                        minWidth: '150px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: isActiveStage ? stageTheme.color : 'hsl(var(--foreground))',
                        fontWeight: isActiveStage ? 800 : 600
                      }}
                      title={stageItem.name}
                    >
                      {stageItem.name}
                    </span>

                    <div style={{ flex: 1, backgroundColor: 'hsl(var(--card-border) / 0.5)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${barWidthPercent}%`,
                          backgroundColor: stageTheme.color || '#477987',
                          height: '100%',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>

                    <span style={{ width: '26px', textAlign: 'right', color: isActiveStage ? stageTheme.color : 'hsl(var(--muted))', fontWeight: 800, fontSize: '12px' }}>
                      {stageItem.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', borderTop: '1px solid hsl(var(--card-border))', paddingTop: '10px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Conversion Funnel Progress</span>
            <span style={{ color: '#1ba37c', fontWeight: 700 }}>
              {activePipelineTotalCount > 0 ? Math.round((activePipelineCompletedCount / activePipelineTotalCount) * 100) : 0}% Active / Followup
            </span>
          </div>
        </div>
      </div>

      {/* Admin 3-Column Grid (Cron Simulator, Division, Top Courses) */}
      {!isSales && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {/* Column 1: Cron Job Simulator */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', marginBottom: '8px' }}>
                Cron job simulator
              </h3>
              <p style={{ fontSize: '13px', color: '#5b7b88', lineHeight: 1.45, margin: '0 0 16px 0' }}>
                Scheduled reminder check scans open leads and automatically postpones overdue reminders.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#5b7b88', fontWeight: 600, marginBottom: '6px' }}>
                  Interval (days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: '80px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbe0e8',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    color: '#162e3b'
                  }}
                />
              </div>

              <button
                onClick={handleTriggerReminders}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#1f4854',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Zap size={15} />
                <span>Run reminder job (+{reminderDays}d)</span>
              </button>
            </div>

            <div
              style={{
                marginTop: '16px',
                padding: '7px 12px',
                backgroundColor: '#eaf2f5',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#5b7b88',
                fontWeight: 500
              }}
            >
              Last run: {lastRunText}
            </div>
          </div>

          {/* Column 2: Leads by division */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', marginBottom: '14px' }}>
                Leads by division
              </h3>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '8px 0 16px 0' }}>
                <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                  <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#477987"
                      strokeWidth="4"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#b6d3dc"
                      strokeWidth="4"
                      strokeDasharray={`${academyPercent} ${100 - academyPercent}`}
                      strokeDashoffset="0"
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#162e3b'
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#477987' }}>{techPercent}%</span>
                    <span style={{ fontSize: '12px', color: '#7a9aa7' }}>{academyPercent}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eef4f7', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#b6d3dc' }} />
                <span style={{ color: '#162e3b', fontWeight: 600 }}>Academy</span>
                <span style={{ color: '#7a9aa7', marginLeft: 'auto' }}>{academyCount} leads</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#477987' }} />
                <span style={{ color: '#162e3b', fontWeight: 600 }}>Technologies</span>
                <span style={{ color: '#7a9aa7', marginLeft: 'auto' }}>{techCount} leads</span>
              </div>
            </div>
          </div>

          {/* Column 3: Top courses by interest */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
                Top courses by interest
              </h3>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#5b7b88' }}>
                {enquiries.length} leads
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {courseInterestCounts.map((courseItem, idx) => {
                const barWidthPercent = courseItem.count > 0 
                  ? Math.max(12, Math.round((courseItem.count / maxCourseCount) * 100)) 
                  : 4;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '12.5px',
                      padding: '4px 6px',
                      borderRadius: '6px'
                    }}
                    title={`${courseItem.name}: ${courseItem.count} leads`}
                  >
                    <span
                      style={{
                        width: '130px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: '#162e3b',
                        fontWeight: 600
                      }}
                      title={courseItem.name}
                    >
                      {courseItem.name}
                    </span>

                    <div style={{ flex: 1, backgroundColor: '#eef5f8', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${barWidthPercent}%`,
                          backgroundColor: '#477987',
                          height: '100%',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>

                    <span style={{ width: '16px', textAlign: 'right', color: '#5b7b88', fontWeight: 700, fontSize: '12px' }}>
                      {courseItem.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales Notes Module (Sales Role Only) */}
      {/* Recent Sales Notes Module (Sales Role & Admin) */}
      {(isSales || user?.role === 'admin') && (
        <div className="glass-card" style={{ padding: '22px 24px' }} id="recent-sales-notes-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(71, 121, 135, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#477987'
                }}
              >
                <StickyNote size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'hsl(var(--foreground))', margin: 0 }}>
                    Recent Sales Notes
                  </h2>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(71, 121, 135, 0.12)',
                      color: '#477987',
                      padding: '2px 8px',
                      borderRadius: '9999px'
                    }}
                  >
                    {salesNotes.length} {salesNotes.length === 1 ? 'note' : 'notes'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#5b7b88', margin: '2px 0 0 0' }}>
                  Quick notes, client follow-ups, and pipeline records logged from the sales desk.
                </p>
              </div>
            </div>

            {/* Top Right: Clean Filter Option + Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', position: 'relative' }} id="sales-filter-dropdown-container">
              {/* Filter Button with Calendar Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(prev => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 15px',
                    borderRadius: '8px',
                    backgroundColor: salesDateFilter !== 'all' ? '#0f766e' : '#107c41',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(16, 124, 65, 0.22)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Filter and Export sales updates by date"
                >
                  <Filter size={15} />
                  <span>Filter</span>
                  {salesDateFilter === 'exact' && salesExactDate && (
                    <span style={{ fontSize: '10.5px', backgroundColor: '#ccfbf1', color: '#0f766e', padding: '1px 7px', borderRadius: '999px', fontWeight: 800 }}>
                      {formatFilterDateLabel(salesExactDate)}
                    </span>
                  )}
                  <ChevronDown size={14} style={{ opacity: 0.85, transform: showFilterDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                </button>

                {showFilterDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '6px',
                      width: '300px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1.5px solid #0f766e',
                      boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.18)',
                      padding: '14px',
                      zIndex: 100,
                      animation: 'slide-in 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} />
                        <span>Filter &amp; Export by Date</span>
                      </div>
                      {salesDateFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleClearDateFilter();
                            setShowFilterDropdown(false);
                          }}
                          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px', lineHeight: 1.4 }}>
                      Select a date from calendar to filter and automatically export to Excel (.xls):
                    </div>

                    {/* Direct Calendar Picker Input */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #0f766e',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        marginBottom: '8px'
                      }}
                    >
                      <Calendar size={15} style={{ color: '#0f766e', flexShrink: 0 }} />
                      <input
                        type="date"
                        value={salesDateFilter === 'exact' ? salesExactDate : ''}
                        onChange={e => {
                          if (e.target.value) {
                            handleFilterAndExportByDate(e.target.value);
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.currentTarget.value || salesExactDate)) {
                            handleFilterAndExportByDate(e.currentTarget.value || salesExactDate);
                          }
                        }}
                        style={{
                          border: 'none',
                          outline: 'none',
                          fontSize: '13px',
                          backgroundColor: 'transparent',
                          color: '#162e3b',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          width: '100%'
                        }}
                        autoFocus
                      />
                    </div>

                    {/* Direct Export Button for Selected Date */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetDate = salesExactDate || new Date().toISOString().split('T')[0];
                        handleFilterAndExportByDate(targetDate);
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#0f766e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '4px',
                        boxShadow: '0 2px 6px rgba(15, 118, 110, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Export notes for selected date to Excel (.xls)"
                    >
                      <Download size={14} />
                      <span>Export {salesExactDate ? formatFilterDateLabel(salesExactDate) : 'Selected Date'} Notes (.xls)</span>
                    </button>

                    {salesDateFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClearDateFilter();
                          setShowFilterDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          marginTop: '6px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#f8fafc',
                          color: '#dc2626',
                          border: '1px solid #fee2e2',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>Reset Filter &amp; Show All Notes</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleRefreshSalesNotes}
                disabled={isRefreshingSalesNotes}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#477987',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: '1px solid #cbe0e8',
                  cursor: isRefreshingSalesNotes ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
                title="Refresh table from database"
              >
                <RotateCcw size={14} style={{ animation: isRefreshingSalesNotes ? 'spin 1s linear infinite' : 'none' }} />
                <span>Refresh</span>
              </button>

              {/* Add Sales Note Button */}
              <button
                type="button"
                onClick={() => setShowAddSalesNoteModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#477987',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(71, 121, 135, 0.25)',
                  transition: 'all 0.15s ease'
                }}
                title="Add new sales note"
              >
                <Plus size={15} />
                <span>Add Note</span>
              </button>
            </div>
          </div>

          {salesNotes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 20px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px dashed #cbe0e8'
              }}
            >
              <BookOpen size={28} style={{ color: '#7a9aa7', display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#162e3b', marginBottom: '4px' }}>
                No sales notes logged yet
              </div>
              <p style={{ fontSize: '13px', color: '#5b7b88', margin: '0 0 14px 0' }}>
                Capture call discussions, follow-up dates, and pipeline stages with one click.
              </p>
              <button
                onClick={() => setShowAddSalesNoteModal(true)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#477987',
                  border: '1px solid #477987',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Add First Sales Note
              </button>
            </div>
          ) : (
            <div>
              {/* Active Filter Status & Search Bar */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #cbe0e8',
                  padding: '9px 14px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                {/* Left: Active Filter Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {overviewCardFilter === 'all' && salesDateFilter === 'all' && notesStageFilter === 'all' && !salesSearchText && salesCategoryFilter === 'all' ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#5b7b88', fontWeight: 600 }}>
                      <Calendar size={14} style={{ color: '#477987' }} />
                      <span>Showing all {filteredSalesNotes.length} notes</span>
                    </div>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Active Overview Card Badge */}
                      {overviewCardFilter !== 'all' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: '#ccfbf1',
                              color: '#0f766e',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Filter size={12} />
                            <span>
                              {overviewCardFilter === 'unresolved'
                                ? `Unresolved Leads (${filteredSalesNotes.length}${notesStageFilter === 'all' ? ` · all stages` : ` · ${notesStageFilter}`})`
                                : `Overview: ${OVERVIEW_CARD_CONFIG[overviewCardFilter].title} (${filteredSalesNotes.length})`}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCardModalKey(overviewCardFilter);
                                setCardModalStageFilter(notesStageFilter !== 'all' ? notesStageFilter : 'all');
                              }}
                              style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', padding: '0 2px', fontWeight: 800, textDecoration: 'underline' }}
                              title="View all in inspector modal"
                            >
                              Inspector Modal
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOverviewCardFilter('all');
                                setNotesStageFilter('all');
                                setSalesNotesCurrentPage(1);
                              }}
                              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                              title="Remove overview filter"
                            >
                              <X size={12} />
                            </button>
                          </span>

                          {/* Quick stage toggle pills when viewing Unresolved leads in the table */}
                          {overviewCardFilter === 'unresolved' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => { setNotesStageFilter('all'); setSalesNotesCurrentPage(1); }}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  border: notesStageFilter === 'all' ? '1.5px solid #0f766e' : '1px solid #cbd5e1',
                                  backgroundColor: notesStageFilter === 'all' ? '#ccfbf1' : '#ffffff',
                                  color: notesStageFilter === 'all' ? '#0f766e' : '#475569',
                                  cursor: 'pointer'
                                }}
                              >
                                All Unresolved ({salesUnresolvedCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = notesStageFilter === 'Lead Generation' ? 'all' : 'Lead Generation';
                                  setNotesStageFilter(next);
                                  setSalesNotesCurrentPage(1);
                                }}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  border: notesStageFilter === 'Lead Generation' ? '1.5px solid #0284c7' : '1px solid rgba(2, 132, 199, 0.3)',
                                  backgroundColor: notesStageFilter === 'Lead Generation' ? 'rgba(2, 132, 199, 0.15)' : '#ffffff',
                                  color: '#0284c7',
                                  cursor: 'pointer'
                                }}
                              >
                                Lead Generation ({activePipelineNotes.filter(n => resolveNoteStage(n) === 'Lead Generation' && !n.is_completed).length})
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Date Filter Badge */}
                      {salesDateFilter !== 'all' && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: '#ccfbf1',
                            color: '#0f766e',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Calendar size={12} />
                          <span>
                            {salesDateFilter === 'exact' ? `Date: ${formatFilterDateLabel(salesExactDate)} (${filteredSalesNotes.length})` :
                             salesDateFilter === 'today' ? `Today (${filteredSalesNotes.length})` :
                             salesDateFilter === 'yesterday' ? `Yesterday (${filteredSalesNotes.length})` :
                             salesDateFilter === 'last7' ? `Last 7 Days (${filteredSalesNotes.length})` :
                             salesDateFilter === 'thisMonth' ? `This Month (${filteredSalesNotes.length})` :
                             `Custom Range (${salesCustomStartDate || 'start'} to ${salesCustomEndDate || 'today'}) (${filteredSalesNotes.length})`}
                          </span>
                          <button
                            type="button"
                            onClick={handleClearDateFilter}
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                            title="Remove date filter"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )}
                      {/* Active Stage Badge */}
                      {notesStageFilter !== 'all' && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: '#e6f3f7',
                            color: '#477987',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>Stage: {notesStageFilter}</span>
                          <button
                            type="button"
                            onClick={() => { setNotesStageFilter('all'); setSalesNotesCurrentPage(1); }}
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                            title="Remove stage filter"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )}

                      {/* Active Workstream Badge */}
                      {salesCategoryFilter !== 'all' && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>Workstream: {salesCategoryFilter}</span>
                          <button
                            type="button"
                            onClick={() => { setSalesCategoryFilter('all'); setSalesNotesCurrentPage(1); }}
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                            title="Remove workstream filter"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Search Input & Filter Reset */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search
                      size={13}
                      style={{
                        position: 'absolute',
                        left: '9px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search updates..."
                      value={salesSearchText}
                      onChange={e => {
                        setSalesSearchText(e.target.value);
                        setSalesNotesCurrentPage(1);
                      }}
                      style={{
                        width: '100%',
                        padding: '5px 26px 5px 28px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        outline: 'none',
                        backgroundColor: '#f8fafc'
                      }}
                    />
                    {salesSearchText && (
                      <button
                        type="button"
                        onClick={() => setSalesSearchText('')}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {(overviewCardFilter !== 'all' || salesDateFilter !== 'all' || notesStageFilter !== 'all' || salesCategoryFilter !== 'all' || salesSearchText) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOverviewCardFilter('all');
                        setSalesCategoryFilter('all');
                        setSalesDateFilter('all');
                        setNotesStageFilter('all');
                        setSalesSearchText('');
                        setSalesCustomStartDate('');
                        setSalesCustomEndDate('');
                        setDropdownCustomStart('');
                        setDropdownCustomEnd('');
                        setSalesNotesCurrentPage(1);
                      }}
                      style={{
                        fontSize: '11.5px',
                        color: '#dc2626',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                      title="Clear all active filters"
                    >
                      Reset All
                    </button>
                  )}
                </div>

              </div>

              {/* 8-Stage Flow Stepper / Filter Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflowX: 'auto',
                  padding: '10px 14px',
                  backgroundColor: 'hsl(var(--card))',
                  borderRadius: '10px',
                  border: '1px solid hsl(var(--card-border))',
                  marginBottom: '16px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setNotesStageFilter('all');
                    setSalesNotesCurrentPage(1);
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    border: notesStageFilter === 'all' ? '1px solid #477987' : '1px solid hsl(var(--card-border))',
                    backgroundColor: notesStageFilter === 'all' ? '#477987' : 'hsl(var(--card))',
                    color: notesStageFilter === 'all' ? '#ffffff' : 'hsl(var(--foreground))',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All Stages ({activePipelineTotalCount})
                </button>

                {SALES_FLOW_STAGES.map((stg, idx) => {
                  const count = activePipelineNotes.filter(n => resolveNoteStage(n) === stg).length;
                  const theme = SALES_STAGE_THEME[stg] || SALES_STAGE_THEME['Target Customer'];
                  const isActive = notesStageFilter === stg;

                  return (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => {
                        setNotesStageFilter(isActive ? 'all' : stg);
                        setSalesCategoryFilter('all');
                        setSalesNotesCurrentPage(1);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        border: isActive ? `1.5px solid ${theme.color}` : '1px solid hsl(var(--card-border))',
                        backgroundColor: isActive ? theme.bg : 'hsl(var(--card))',
                        color: isActive ? theme.color : 'hsl(var(--foreground))',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? theme.color : 'hsl(var(--card-border))',
                          color: isActive ? '#ffffff' : 'hsl(var(--muted-foreground))',
                          fontSize: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span>{stg}</span>
                      {count > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '8px',
                            backgroundColor: theme.bg,
                            color: theme.color,
                            fontWeight: 800
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Notes Table View (Reference Image Format) */}
              {(() => {
                const totalSalesNotesPages = Math.ceil(filteredSalesNotes.length / salesNotesRowsPerPage) || 1;
                const startSalesNotesIdx = (salesNotesCurrentPage - 1) * salesNotesRowsPerPage;
                const paginatedSalesNotes = filteredSalesNotes.slice(startSalesNotesIdx, startSalesNotesIdx + salesNotesRowsPerPage);

                if (filteredSalesNotes.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '36px 24px', color: '#64748b', fontSize: '13px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                      <Calendar size={28} style={{ color: '#94a3b8', margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                        No sales updates found matching your filter criteria
                      </div>
                      <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#64748b' }}>
                        {salesDateFilter === 'today' ? "No sales updates logged or due for today." : "Try choosing a different date range or clearing your stage/search filter."}
                      </p>
                      <button
                        onClick={() => {
                          setSalesDateFilter('all');
                          setNotesStageFilter('all');
                          setSalesSearchText('');
                          setSalesCustomStartDate('');
                          setSalesCustomEndDate('');
                          setSalesNotesCurrentPage(1);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          backgroundColor: '#477987',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Reset All Filters ({salesNotes.length} notes)
                      </button>
                    </div>
                  );
                }

                return (
                  <div>
                    <div className="table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{ width: '130px' }}>Created Date</th>
                            <th style={{ width: '180px' }}>Pipeline Stage</th>
                            <th style={{ width: '160px' }}>Work Stream</th>
                            <th>Note Content / Client Discussion</th>
                            <th style={{ width: '130px' }}>Next Alert</th>
                            <th style={{ width: '130px' }}>Logged By</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSalesNotes.map(note => {
                            const stage = resolveNoteStage(note);
                            const theme = stage ? (SALES_STAGE_THEME[stage] || SALES_STAGE_THEME['Target Customer']) : null;
                            const dueInfo = formatRelativeDue(note.reminderDate);
                            const categories = resolveNoteCategories(note);
                            const workstream = categories[0] || (note.category && note.category !== 'null' && note.category !== 'None' ? note.category : null);
                            const wsConfig = workstream ? (WORKSTREAM_CATEGORIES.find(c => c.value.toLowerCase() === String(workstream).toLowerCase()) || {
                              value: workstream as any,
                              label: workstream,
                              icon: '📌',
                              color: '#477987',
                              bg: 'rgba(71, 121, 135, 0.12)',
                              border: 'rgba(71, 121, 135, 0.35)'
                            }) : null;

                            return (
                              <tr key={note.id}>
                                <td style={{ fontSize: '12.5px', color: '#5b7b88', fontWeight: 500, verticalAlign: 'middle' }}>
                                  {new Date(note.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  {stage && theme ? (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: theme.color,
                                        backgroundColor: theme.bg,
                                        border: `1px solid ${theme.border}`,
                                        borderRadius: '9999px',
                                        padding: '3px 10px',
                                        whiteSpace: 'nowrap',
                                        textTransform: 'uppercase'
                                      }}
                                    >
                                      {stage}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>—</span>
                                  )}
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  {workstream && wsConfig ? (
                                    <span
                                      onClick={(e) => { e.stopPropagation(); setSalesCategoryFilter(workstream); setSalesNotesCurrentPage(1); }}
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        backgroundColor: wsConfig.bg,
                                        color: wsConfig.color,
                                        border: `1px solid ${wsConfig.border}`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer'
                                      }}
                                      title={`Filter by ${workstream}`}
                                    >
                                      <span>{wsConfig.icon}</span>
                                      <span>{workstream}</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>—</span>
                                  )}
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  <div style={{ fontSize: '13.5px', color: 'hsl(var(--foreground))', fontWeight: 500, lineHeight: 1.45, maxWidth: '480px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {note.content}
                                  </div>
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  {note.reminderDate ? (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: dueInfo.color,
                                        backgroundColor: dueInfo.bg,
                                        border: `1px solid ${dueInfo.border}`,
                                        borderRadius: '10px',
                                        padding: '2px 9px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {dueInfo.text}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#a0b6c0', fontSize: '12px' }}>-</span>
                                  )}
                                </td>
                                <td style={{ fontSize: '12.5px', color: '#477987', fontWeight: 600, verticalAlign: 'middle' }}>
                                  {note.created_by || 'Sales Desk'}
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSalesNoteModal(note)}
                                      className="btn btn-ghost btn-icon"
                                      style={{ width: '32px', height: '32px', padding: 0 }}
                                      title="Edit Sales Note"
                                    >
                                      <Edit size={15} style={{ color: 'hsl(var(--primary))' }} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setNoteToDelete(note)}
                                      className="btn btn-ghost btn-icon hover-danger"
                                      style={{ width: '32px', height: '32px', padding: 0, color: '#dc2626' }}
                                      title="Delete Sales Note"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination matching reference format */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid hsl(var(--card-border))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label htmlFor="select-sales-notes-rows" style={{ fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                          Rows per page
                        </label>
                        <select
                          id="select-sales-notes-rows"
                          value={salesNotesRowsPerPage}
                          onChange={(e) => {
                            setSalesNotesRowsPerPage(Number(e.target.value));
                            setSalesNotesCurrentPage(1);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid hsl(var(--card-border))',
                            background: 'hsl(var(--background))',
                            fontSize: '13px',
                            color: 'hsl(var(--foreground))',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                          Page {salesNotesCurrentPage} of {totalSalesNotesPages}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => setSalesNotesCurrentPage(p => Math.max(1, p - 1))}
                            disabled={salesNotesCurrentPage === 1}
                            className="btn btn-ghost btn-icon"
                            style={{ width: '32px', height: '32px', opacity: salesNotesCurrentPage === 1 ? 0.5 : 1, cursor: salesNotesCurrentPage === 1 ? 'not-allowed' : 'pointer', border: '1px solid hsl(var(--card-border))' }}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => setSalesNotesCurrentPage(p => Math.min(totalSalesNotesPages, p + 1))}
                            disabled={salesNotesCurrentPage === totalSalesNotesPages}
                            className="btn btn-ghost btn-icon"
                            style={{ width: '32px', height: '32px', opacity: salesNotesCurrentPage === totalSalesNotesPages ? 0.5 : 1, cursor: salesNotesCurrentPage === totalSalesNotesPages ? 'not-allowed' : 'pointer', border: '1px solid hsl(var(--card-border))' }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {salesNotes.length > 10 && (
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button
                    onClick={() => onNavigateTab?.('notes')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#477987',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Open Full Notes Management →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leads board requiring action (Admin only; hidden on Sales Dashboard) */}
      {!isSales && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#162e3b' }}>
              Leads needing action ({filteredActionLeads.length})
            </h2>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActionFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: actionFilter === 'all' ? '#477987' : '#ffffff',
                  color: actionFilter === 'all' ? '#ffffff' : '#345967',
                  border: actionFilter === 'all' ? 'none' : '1px solid #cbe0e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                All ({unresolvedEnquiries.length})
              </button>

              <button
                onClick={() => setActionFilter('unreachable')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: actionFilter === 'unreachable' ? '#477987' : '#ffffff',
                  color: actionFilter === 'unreachable' ? '#ffffff' : '#345967',
                  border: actionFilter === 'unreachable' ? 'none' : '1px solid #cbe0e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                Not reachable ({notReachableCount})
              </button>

              <button
                onClick={() => setActionFilter('pending')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: actionFilter === 'pending' ? '#477987' : '#ffffff',
                  color: actionFilter === 'pending' ? '#ffffff' : '#345967',
                  border: actionFilter === 'pending' ? 'none' : '1px solid #cbe0e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                Follow-up pending ({followUpPendingCount})
              </button>
            </div>
          </div>

          {filteredActionLeads.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '36px', color: '#5b7b88' }}>
              <CheckCircle size={32} style={{ color: '#1ba37c', display: 'block', margin: '0 auto 12px' }} />
              All logged enquiries are fully resolved. No action items remaining!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredActionLeads.map(enq => (
                <EnquiryCard
                  key={enq.id}
                  enquiry={enq}
                  courses={courses}
                  categories={categories}
                  onEdit={(targetEnq) => setEditingEnquiry(targetEnq)}
                  onToggleStatus={handleToggleStatus}
                  hideCourseDetails={isSales}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Database table showing Full Leads Ledger (Admin only; hidden on Sales Dashboard) */}
      {!isSales && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>
              Full Leads Ledger ({filteredAllEnquiries.length})
            </h2>
          </div>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Course Interest</th>
                  <th>Category</th>
                  <th>Phone</th>
                  <th>Details shared</th>
                  <th>Next Alert</th>
                  <th>Resolution Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEnquiries.map(e => {
                  const course = courses.find(c => c.id === e.course_id);
                  const category = categories.find(c => c.id === e.category_id);
                  const isRes = e.interested !== null && e.follow_up_done !== null && e.can_follow_up !== null;

                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{e.contact_name}</span>
                          {e.notes && (
                            <span
                              title={`Note: ${e.notes}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: '#477987',
                                cursor: 'pointer',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#eef5f8'
                              }}
                              onClick={(evt) => {
                                evt.stopPropagation();
                                setEditingEnquiry(e);
                              }}
                            >
                              <StickyNote size={13} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{course?.name || 'N/A'}</td>
                      <td>
                        <span className={`badge ${category?.name === 'Technologies' ? 'badge-tech' : 'badge-academy'}`}>
                          {category?.name || 'N/A'}
                        </span>
                      </td>
                      <td>{e.contact_phone || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: e.fee_shared ? 'hsl(var(--success))' : 'hsl(var(--muted))', fontWeight: 600 }}>
                            {e.fee_shared ? 'Shared' : 'Pending'}
                          </span>
                          {e.payment && (
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 600, 
                              color: e.payment === 'Completed' ? 'hsl(var(--success))' : e.payment === 'Partially Paid' ? '#d97706' : 'hsl(var(--muted))' 
                            }}>
                              {e.payment}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'hsl(var(--muted))' }}>
                        {isRes ? 'Resolved' : new Date(e.next_reminder_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: e.interested === true ? 'hsl(var(--success))' : e.interested === false ? 'hsl(var(--danger))' : 'hsl(var(--warning))'
                            }}
                            title={`Interested: ${e.interested === null ? 'Pending' : e.interested}`}
                          />
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: e.follow_up_done === true ? 'hsl(var(--success))' : e.follow_up_done === false ? 'hsl(var(--danger))' : 'hsl(var(--warning))'
                            }}
                            title={`Follow Up: ${e.follow_up_done === null ? 'Pending' : e.follow_up_done}`}
                          />
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: e.can_follow_up === true ? 'hsl(var(--success))' : e.can_follow_up === false ? 'hsl(var(--danger))' : 'hsl(var(--warning))'
                            }}
                            title={`Reachable: ${e.can_follow_up === null ? 'Pending' : e.can_follow_up}`}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setEditingEnquiry(e)}
                          className="btn btn-ghost btn-icon"
                          style={{ width: '32px', height: '32px', padding: 0 }}
                          title="Edit Lead Details"
                        >
                          <Edit size={16} style={{ color: 'hsl(var(--primary))' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paginatedEnquiries.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--muted))' }}>
                      No leads recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid hsl(var(--card-border))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label htmlFor="select-rows-per-page" style={{ fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                Rows per page
              </label>
              <select
                id="select-rows-per-page"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--card-border))',
                  background: 'hsl(var(--background))',
                  fontSize: '13px',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-icon"
                  style={{ width: '32px', height: '32px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', border: '1px solid hsl(var(--card-border))' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-icon"
                  style={{ width: '32px', height: '32px', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', border: '1px solid hsl(var(--card-border))' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Enquiry Modal */}
      {editingEnquiry && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1150,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'hsl(var(--card))',
              borderRadius: '12px',
              border: '1px solid hsl(var(--card-border))',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
              padding: '24px 32px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit size={22} style={{ color: 'hsl(var(--primary))' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Edit Lead Details</h3>
              </div>
              <button
                onClick={() => setEditingEnquiry(null)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px', color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                  value={editingEnquiry.contact_name}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, contact_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: !isSales ? '1fr 1fr' : '1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingEnquiry.contact_phone || ''}
                    onChange={e => setEditingEnquiry({ ...editingEnquiry, contact_phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>

                {!isSales && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                      Course Choice *
                    </label>
                    <select
                      className="form-input"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                      value={editingEnquiry.course_id}
                      onChange={e => setEditingEnquiry({ ...editingEnquiry, course_id: e.target.value })}
                      required={!isSales}
                    >
                      <option value="" disabled>Select a course</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Category
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                  value={editingEnquiry.category_id}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, category_id: e.target.value })}
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Next Scheduled Reminder
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                  value={editingEnquiry.next_reminder_at ? editingEnquiry.next_reminder_at.split('T')[0] : ''}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, next_reminder_at: new Date(e.target.value).toISOString() })}
                />
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingEnquiry.fee_shared}
                    onChange={e => setEditingEnquiry({ ...editingEnquiry, fee_shared: e.target.checked })}
                  />
                  <span>Fee Structure Shared</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Lead Conversation / Status Notes
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                  value={editingEnquiry.notes || ''}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, notes: e.target.value })}
                  placeholder="Additional context on inquiry..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingEnquiry(null)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', backgroundColor: '#1f4854', color: '#ffffff' }}
                >
                  {isSavingEdit ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sales Note Modal (Reference Image 2 Format) */}
      {editingSalesNote && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1150,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'hsl(var(--card))',
              borderRadius: '12px',
              border: '1px solid hsl(var(--card-border))',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
              padding: '24px 32px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit size={22} style={{ color: 'hsl(var(--primary))' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Edit Sales Note Details</h3>
              </div>
              <button
                onClick={() => setEditingSalesNote(null)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px', color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSalesNote} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Note Content / Client Conversation *
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                  value={editingSalesNote.content}
                  onChange={e => setEditingSalesNote({ ...editingSalesNote, content: e.target.value })}
                  placeholder="Record call, meeting or proposal details..."
                  required
                />
              </div>

              <div className="modal-form-fields-grid">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                    Workstream
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingSalesNote.category || resolveNoteCategories(editingSalesNote)[0] || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditingSalesNote({
                        ...editingSalesNote,
                        category: val ? (val as SalesWorkstreamCategory) : undefined
                      });
                    }}
                  >
                    <option value="">-- None (null) --</option>
                    {WORKSTREAM_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                    Pipeline Stage
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingSalesNote.stage || resolveNoteStage(editingSalesNote) || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditingSalesNote({
                        ...editingSalesNote,
                        stage: val ? (val as NoteStage) : undefined
                      });
                    }}
                  >
                    <option value="">-- None (null) --</option>
                    {SALES_FLOW_STAGES.map(stg => (
                      <option key={stg} value={stg}>{stg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                      Follow-up Date (Optional)
                    </label>
                    {editingSalesNote.reminderDate && (
                      <button
                        type="button"
                        onClick={() => setEditingSalesNote({ ...editingSalesNote, reminderDate: undefined })}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingSalesNote.reminderDate || ''}
                    onChange={e => setEditingSalesNote({ ...editingSalesNote, reminderDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = editingSalesNote;
                    setEditingSalesNote(null);
                    setNoteToDelete(toDelete);
                  }}
                  className="btn btn-ghost"
                  style={{
                    padding: '8px 14px',
                    color: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px'
                  }}
                >
                  <Trash2 size={15} />
                  <span>Delete Note</span>
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingSalesNote(null)}
                    className="btn btn-secondary"
                    style={{ padding: '10px 20px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '10px 24px', backgroundColor: '#1f4854', color: '#ffffff' }}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sales Note Modal */}
      {showAddSalesNoteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1150,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'hsl(var(--card))',
              borderRadius: '14px',
              border: '1px solid hsl(var(--card-border))',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.2)',
              padding: '26px 32px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(71, 121, 135, 0.12)', color: '#477987', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'hsl(var(--foreground))', margin: 0 }}>Add New Sales Note</h3>
                  <p style={{ fontSize: '12.5px', color: 'hsl(var(--muted-foreground))', margin: '2px 0 0 0' }}>Record client conversation, discussion updates, or follow-ups</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSalesNoteModal(false)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px', color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSalesNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Discussion Details / Client Notes *
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: 'hsl(var(--background))', fontSize: '13.5px', lineHeight: 1.5 }}
                  value={newSalesNoteContent}
                  onChange={e => setNewSalesNoteContent(e.target.value)}
                  placeholder="Record client outreach, meeting notes, project scope discussion, or call feedback..."
                  required
                  autoFocus
                />
              </div>

              <div className="modal-form-fields-grid">
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '6px' }}>
                    Workstream
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'hsl(var(--background))', fontSize: '12.5px' }}
                    value={newSalesNoteCategory}
                    onChange={e => {
                      const val = e.target.value;
                      setNewSalesNoteCategory(val ? (val as SalesWorkstreamCategory) : '');
                    }}
                  >
                    <option value="">-- None (null) --</option>
                    {WORKSTREAM_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '6px' }}>
                    Pipeline Stage
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'hsl(var(--background))', fontSize: '12.5px' }}
                    value={newSalesNoteStage}
                    onChange={e => {
                      const val = e.target.value;
                      setNewSalesNoteStage(val ? (val as NoteStage) : '');
                    }}
                  >
                    <option value="">-- None (null) --</option>
                    {SALES_FLOW_STAGES.map(stg => (
                      <option key={stg} value={stg}>{stg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      Follow-up Date (Optional)
                    </label>
                    {newSalesNoteReminder && (
                      <button
                        type="button"
                        onClick={() => setNewSalesNoteReminder('')}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'hsl(var(--background))', fontSize: '12.5px' }}
                    value={newSalesNoteReminder}
                    onChange={e => setNewSalesNoteReminder(e.target.value)}
                    title="Follow-up Date (Optional - leave blank if not scheduled)"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSalesNoteModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '9px 20px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewSalesNote || !newSalesNoteContent.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '9px 24px',
                    backgroundColor: '#477987',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: (isSavingNewSalesNote || !newSalesNoteContent.trim()) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Plus size={15} />
                  <span>{isSavingNewSalesNote ? 'Saving...' : 'Add Sales Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Sales Note Confirmation Modal */}
      {noteToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'hsl(var(--card))',
              borderRadius: '14px',
              border: '1px solid hsl(var(--card-border))',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.2)',
              padding: '24px 28px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(220, 38, 38, 0.12)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#162e3b', margin: '0 0 6px 0' }}>
                  Delete Sales Note?
                </h3>
                <p style={{ fontSize: '13px', color: '#5b7b88', margin: 0, lineHeight: 1.5 }}>
                  Are you sure you want to delete this sales note? This will permanently remove the record from your sales pipeline.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #eef4f7',
                marginBottom: '20px',
                fontSize: '12.5px',
                color: '#334155',
                fontStyle: 'italic',
                lineHeight: 1.45,
                maxHeight: '80px',
                overflowY: 'auto'
              }}
            >
              "{noteToDelete.content}"
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSalesNote(noteToDelete.id)}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} />
                <span>Delete Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overview Card Details Modal (Shows what are the 43 unsolved leads / notes) */}
      {activeCardModalKey && (
        <div
          className="overview-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveCardModalKey(null);
            }
          }}
        >
          <div className="overview-modal-container">
            {(() => {
              const config = OVERVIEW_CARD_CONFIG[activeCardModalKey];
              const IconComp = config.icon;
              const matchingSalesNotes = isSales ? getSalesCardNotes(activeCardModalKey) : [];
              const matchingEnquiries = !isSales ? getAdminCardEnquiries(activeCardModalKey) : [];
              const rawTotal = isSales ? matchingSalesNotes.length : matchingEnquiries.length;

              // Calculate stage breakdown for sales notes inside modal
              const modalStageCounts: Record<string, number> = {};
              if (isSales) {
                matchingSalesNotes.forEach(n => {
                  const stg = resolveNoteStage(n) || 'Other';
                  modalStageCounts[stg] = (modalStageCounts[stg] || 0) + 1;
                });
              }
              const modalAvailableStages = Object.entries(modalStageCounts).sort((a, b) => {
                if (a[0] === 'Lead Generation') return -1;
                if (b[0] === 'Lead Generation') return 1;
                return b[1] - a[1];
              });

              // Filter by stage and search inside the modal
              const searchQ = cardModalSearch.trim().toLowerCase();
              const filteredModalNotes = matchingSalesNotes.filter(n => {
                if (cardModalStageFilter !== 'all') {
                  const noteStage = resolveNoteStage(n) || 'Other';
                  if (noteStage !== cardModalStageFilter) return false;
                }
                if (!searchQ) return true;
                const c = (n.content || '').toLowerCase();
                const stg = (n.stage || n.action_item || '').toLowerCase();
                const by = (n.created_by || '').toLowerCase();
                const cat = (n.category || '').toLowerCase();
                return c.includes(searchQ) || stg.includes(searchQ) || by.includes(searchQ) || cat.includes(searchQ);
              });

              const filteredModalEnquiries = matchingEnquiries.filter(e => {
                if (!searchQ) return true;
                const name = (e.contact_name || '').toLowerCase();
                const phone = (e.contact_phone || '').toLowerCase();
                const note = (e.notes || '').toLowerCase();
                return name.includes(searchQ) || phone.includes(searchQ) || note.includes(searchQ);
              });

              return (
                <>
                  {/* Modal Header */}
                  <div className="overview-modal-header">
                    <div className="overview-modal-header-top">
                      <div className="overview-modal-header-info">
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            backgroundColor: config.bg,
                            color: config.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <IconComp size={22} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                              {config.title}
                            </h3>
                            <span
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: config.bg,
                                color: config.color,
                                border: `1px solid ${config.borderColor}`,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {rawTotal} {rawTotal === 1 ? (isSales ? 'note' : 'lead') : (isSales ? 'notes' : 'leads')}
                            </span>
                          </div>
                          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                            {config.description}
                          </p>
                        </div>
                      </div>

                      {/* Close button always anchored at top-right */}
                      <button
                        type="button"
                        onClick={() => setActiveCardModalKey(null)}
                        className="btn btn-ghost btn-icon"
                        style={{ width: '34px', height: '34px', borderRadius: '8px', color: '#64748b', flexShrink: 0 }}
                        title="Close modal"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Action buttons row under header */}
                    {isSales && (
                      <div className="overview-modal-header-actions">
                        {matchingSalesNotes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleExportCardNotes(activeCardModalKey)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '7px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#107c41',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 2px 5px rgba(16, 124, 65, 0.2)'
                            }}
                            title="Export these notes to Excel (.xls)"
                          >
                            <FileSpreadsheet size={14} />
                            <span>Export Excel</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setOverviewCardFilter(activeCardModalKey);
                            setNotesStageFilter(cardModalStageFilter);
                            setSalesCategoryFilter('all');
                            setSalesDateFilter('all');
                            setSalesSearchText('');
                            setActiveCardModalKey(null);
                            setSalesNotesCurrentPage(1);
                            const el = document.getElementById('recent-sales-notes-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            showToast(
                              cardModalStageFilter === 'all'
                                ? `Filtered table below to all ${rawTotal} ${OVERVIEW_CARD_CONFIG[activeCardModalKey].title.toLowerCase()}`
                                : `Filtered table below to ${cardModalStageFilter} (${filteredModalNotes.length} notes)`,
                              'info'
                            );
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#eef5f8',
                            color: '#477987',
                            fontSize: '12px',
                            fontWeight: 700,
                            border: '1px solid #cbe0e8',
                            cursor: 'pointer'
                          }}
                          title="View and filter in the table below"
                        >
                          <Filter size={14} />
                          <span>Filter in Table Below</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Search bar inside modal */}
                  <div className="overview-modal-search-row">
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        value={cardModalSearch}
                        onChange={(e) => setCardModalSearch(e.target.value)}
                        placeholder={`Search within these ${rawTotal} ${isSales ? 'notes' : 'leads'} (content, stage, person)...`}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          fontSize: '13px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          backgroundColor: '#f8fafc'
                        }}
                      />
                      {cardModalSearch && (
                        <button
                          type="button"
                          onClick={() => setCardModalSearch('')}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <span className="overview-modal-search-count" style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      Showing {isSales ? filteredModalNotes.length : filteredModalEnquiries.length} of {rawTotal}
                    </span>
                  </div>

                  {/* Stage filter pills inside modal (Sales Desk) */}
                  {isSales && modalAvailableStages.length > 1 && (
                    <div className="overview-modal-stages-bar">
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>
                        Pipeline Stage:
                      </span>
                      <button
                        type="button"
                        onClick={() => setCardModalStageFilter('all')}
                        style={{
                          padding: '4px 11px',
                          borderRadius: '9999px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          border: cardModalStageFilter === 'all' ? '1.5px solid #1ba37c' : '1px solid #cbd5e1',
                          backgroundColor: cardModalStageFilter === 'all' ? '#dcfce7' : '#ffffff',
                          color: cardModalStageFilter === 'all' ? '#15803d' : '#475569',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          flexShrink: 0,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>All Stages</span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '999px',
                          backgroundColor: cardModalStageFilter === 'all' ? '#15803d' : '#f1f5f9',
                          color: cardModalStageFilter === 'all' ? '#ffffff' : '#64748b'
                        }}>
                          {rawTotal}
                        </span>
                      </button>
                      {modalAvailableStages.map(([stgName, count]) => {
                        const isSelected = cardModalStageFilter === stgName;
                        const theme = SALES_STAGE_THEME[stgName] || { color: '#477987', bg: 'rgba(71, 121, 135, 0.12)', border: 'rgba(71, 121, 135, 0.3)' };
                        return (
                          <button
                            key={stgName}
                            type="button"
                            onClick={() => setCardModalStageFilter(isSelected ? 'all' : stgName)}
                            style={{
                              padding: '4px 11px',
                              borderRadius: '9999px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              border: isSelected ? `2px solid ${theme.color}` : `1px solid ${theme.border}`,
                              backgroundColor: isSelected ? theme.bg : '#ffffff',
                              color: theme.color,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              flexShrink: 0,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span>{stgName}</span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '999px',
                              backgroundColor: isSelected ? theme.color : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#64748b'
                            }}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Scrollable list of items */}
                  <div className="overview-modal-scroll-area">
                    {/* Notice banner for Unresolved leads explaining that all 46 leads across all stages are shown */}
                    {isSales && activeCardModalKey === 'unresolved' && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          fontSize: '12.5px',
                          color: '#166534',
                          flexWrap: 'wrap',
                          flexShrink: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Package size={17} style={{ color: '#15803d', flexShrink: 0 }} />
                          <span>
                            Viewing <strong>{cardModalStageFilter === 'all' ? `all ${rawTotal} unresolved leads` : `${filteredModalNotes.length} ${cardModalStageFilter} leads`}</strong> across the sales pipeline
                            {modalStageCounts['Lead Generation'] ? ` (including ${modalStageCounts['Lead Generation']} in Lead Generation stage)` : ''}.
                          </span>
                        </div>
                        {cardModalStageFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setCardModalStageFilter('all')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#15803d',
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                          >
                            Show All {rawTotal} Unresolved Leads
                          </button>
                        )}
                      </div>
                    )}
                    {isSales ? (
                      filteredModalNotes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                          <CheckCircle2 size={40} style={{ color: '#1ba37c', margin: '0 auto 12px', display: 'block' }} />
                          <div style={{ fontWeight: 800, fontSize: '16px', color: '#1e293b' }}>
                            {cardModalSearch ? 'No notes matching your search' : 'No records found in this category'}
                          </div>
                          <p style={{ fontSize: '13px', margin: '6px 0 0 0', color: '#64748b' }}>
                            {cardModalSearch ? 'Try a different search keyword.' : 'All leads in this section have been resolved or addressed!'}
                          </p>
                        </div>
                      ) : (
                        filteredModalNotes.map((note, index) => {
                          const stage = resolveNoteStage(note);
                          const stageTheme = stage ? (SALES_STAGE_THEME[stage] || SALES_STAGE_THEME['Target Customer']) : null;
                          const dueInfo = formatRelativeDue(note.reminderDate);
                          const categories = resolveNoteCategories(note);
                          const workstream = categories[0] || null;
                          const isResolved = Boolean(note.is_completed || (stage && (stage === 'Customer Onboarding' || stage === 'Converted')));

                          return (
                            <div
                              key={note.id || index}
                              className="overview-note-card"
                              style={{
                                border: isResolved ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                backgroundColor: isResolved ? 'rgba(240, 253, 244, 0.65)' : '#ffffff'
                              }}
                            >
                              {/* Top row: Stage, Workstream, Relative Date, Status */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>
                                    #{index + 1}
                                  </span>

                                  {stage && stageTheme ? (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        color: stageTheme.color,
                                        backgroundColor: stageTheme.bg,
                                        border: `1px solid ${stageTheme.border}`,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        textTransform: 'uppercase',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {stage}
                                    </span>
                                  ) : null}

                                  {workstream ? (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#477987',
                                        backgroundColor: 'rgba(71, 121, 135, 0.12)',
                                        border: '1px solid rgba(71, 121, 135, 0.3)',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {workstream}
                                    </span>
                                  ) : null}

                                  <span style={{ fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {note.timestamp ? new Date(note.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {note.reminderDate && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: dueInfo.bg,
                                        color: dueInfo.color,
                                        border: `1px solid ${dueInfo.border}`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <Bell size={11} />
                                      {dueInfo.text}
                                    </span>
                                  )}

                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: isResolved ? '#dcfce7' : '#fef3c7',
                                      color: isResolved ? '#15803d' : '#b45309',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {isResolved ? 'Resolved' : 'Pending Follow-up'}
                                  </span>
                                </div>
                              </div>

                              {/* Note text / Discussion details */}
                              <div
                                style={{
                                  fontSize: '13.5px',
                                  color: '#1e293b',
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  overflowWrap: 'anywhere',
                                  padding: '10px 14px',
                                  backgroundColor: isResolved ? '#f0fdf4' : '#f8fafc',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(0,0,0,0.04)'
                                }}
                              >
                                {note.content}
                              </div>

                              {/* Footer: Creator & Actions */}
                              <div className="overview-note-card-footer">
                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                  Logged by: <strong style={{ color: '#334155' }}>{note.created_by || 'Sales Desk'}</strong>
                                </span>

                                <div className="overview-note-card-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyNoteContent(note)}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="Copy note text to clipboard"
                                  >
                                    {copiedNoteId === note.id ? <Check size={12} style={{ color: '#15803d' }} /> : <Copy size={12} />}
                                    <span>{copiedNoteId === note.id ? 'Copied!' : 'Copy'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenEditSalesNoteModal(note);
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="Edit this note"
                                  >
                                    <Edit size={12} />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleSalesNoteComplete(note)}
                                    style={{
                                      padding: '5px 12px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      border: 'none',
                                      backgroundColor: isResolved ? '#e2e8f0' : '#1ba37c',
                                      color: isResolved ? '#334155' : '#ffffff',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      boxShadow: isResolved ? 'none' : '0 2px 4px rgba(27, 163, 124, 0.25)',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    <CheckCircle size={13} />
                                    <span>{isResolved ? 'Mark Pending' : 'Mark Resolved'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : (
                      /* Admin Enquiries list */
                      filteredModalEnquiries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                          <CheckCircle2 size={40} style={{ color: '#1ba37c', margin: '0 auto 12px', display: 'block' }} />
                          <div style={{ fontWeight: 800, fontSize: '16px', color: '#1e293b' }}>No enquiries found</div>
                        </div>
                      ) : (
                        filteredModalEnquiries.map((enq, idx) => {
                          const course = courses.find(c => c.id === enq.course_id);
                          const isRes = enq.interested !== null && enq.follow_up_done !== null && enq.can_follow_up !== null;

                          return (
                            <div
                              key={enq.id || idx}
                              className="overview-note-card"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{enq.contact_name}</span>
                                  {enq.contact_phone && (
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>• {enq.contact_phone}</span>
                                  )}
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: isRes ? '#dcfce7' : '#fef3c7', color: isRes ? '#15803d' : '#b45309', whiteSpace: 'nowrap' }}>
                                  {isRes ? 'Resolved' : 'Action Required'}
                                </span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                                <strong>Course Interest:</strong> {course?.name || 'General Inquiry'}
                              </div>
                              {enq.notes && (
                                <div style={{ fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', lineHeight: 1.45, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                  {enq.notes}
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingEnquiry(enq)}
                                  style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Edit size={12} />
                                  <span>Edit Lead</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="overview-modal-footer">
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                      Global Minds Technologies Sales Lead Desk
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCardModalKey(null)}
                      className="btn btn-secondary"
                      style={{ padding: '7px 18px', fontSize: '12.5px', fontWeight: 600 }}
                    >
                      Close Viewer
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
