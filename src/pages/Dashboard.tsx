import React, { useState, useEffect } from 'react';
import {
  Bell,
  CloudLightning,
  CheckCircle,
  Edit,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Phone,
  Package,
  IndianRupee,
  PhoneOff,
  Info,
  Zap,
  BookOpen,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronDown,
  Search,
  Filter,
  ArrowUpRight,
  Check,
  TrendingUp,
  ListTodo,
  Trash2
} from 'lucide-react';
import EnquiryCard from '../components/EnquiryCard';
import {
  getLocalEnquiries,
  getLocalCourses,
  getLocalCategories,
  updateLocalEnquiry,
  getLocalNotes,
  saveLocalNote,
  updateLocalNote,
  deleteLocalNote,
  getCurrentUserSession,
  type Enquiry,
  type Course,
  type Category,
  type Note,
  type NoteStage,
  type UserSession
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const DASHBOARD_STAGES: NoteStage[] = [
  'Reached Out',
  'Pipeline',
  'Converted',
  'To Be Follow Up',
  'Delivery Due'
];

export const DASHBOARD_STAGE_THEME: Record<string, { bg: string; color: string; border: string }> = {
  'Reached Out': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.35)' },
  'Pipeline': { bg: 'rgba(71, 121, 135, 0.15)', color: '#477987', border: 'rgba(71, 121, 135, 0.35)' },
  'Converted': { bg: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c', border: 'rgba(27, 163, 124, 0.35)' },
  'To Be Follow Up': { bg: 'rgba(217, 119, 6, 0.15)', color: '#d97706', border: 'rgba(217, 119, 6, 0.35)' },
  'Delivery Due': { bg: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.35)' }
};

export const resolveNoteStage = (n: Note): NoteStage => {
  if (n.stage && DASHBOARD_STAGES.includes(n.stage as NoteStage)) {
    return n.stage as NoteStage;
  }
  const action = (n.action_item || '').toLowerCase().trim();
  if (action === 'completed') return 'Converted';
  if (action === 'pending') return 'To Be Follow Up';
  if (action === 'reached out') return 'Reached Out';
  if (action === 'pipeline') return 'Pipeline';
  if (action === 'converted') return 'Converted';
  if (action === 'to be follow up') return 'To Be Follow Up';
  if (action === 'delivery due') return 'Delivery Due';
  return 'Reached Out';
};

interface DashboardProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateToLead?: (prefillName?: string) => void;
  currentUser?: UserSession | null;
  onNavigateTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate,
  onNavigateToLead,
  currentUser,
  onNavigateTab
}) => {
  const user = currentUser || getCurrentUserSession();
  const isSales = user?.role === 'sales';

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Notes filtering & search state
  const [selectedNoteStageFilter, setSelectedNoteStageFilter] = useState<'All' | NoteStage>('All');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [openNoteDropdownId, setOpenNoteDropdownId] = useState<string | null>(null);

  // Quick note form state
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [quickNoteStage, setQuickNoteStage] = useState<NoteStage>('Reached Out');
  const [quickNoteReminder, setQuickNoteReminder] = useState('');

  // Dashboard note editing state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteStage, setEditNoteStage] = useState<NoteStage>('Reached Out');
  const [editNoteReminder, setEditNoteReminder] = useState('');

  // Dashboard notes pagination
  const [notesCurrentPage, setNotesCurrentPage] = useState(1);
  const [notesRowsPerPage, setNotesRowsPerPage] = useState(8);

  // Toast feedback state (replaces blocking alerts)
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dashboard-note-dropdown-container')) {
        setOpenNoteDropdownId(null);
      }
    };
    if (openNoteDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openNoteDropdownId]);

  const fetchDashboardData = async () => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: cats } = await supabase.from('categories').select('*');
        const { data: crs } = await supabase.from('courses').select('*');
        const { data: enqs } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });
        const { data: nts } = await supabase.from('notes').select('*').order('timestamp', { ascending: false });

        if (cats) setCategories(cats);
        if (crs) setCourses(crs);
        if (enqs) setEnquiries(enqs);
        if (nts) setNotes(nts as Note[]);
        else setNotes(getLocalNotes());
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
    setNotes(getLocalNotes());

    // Sort enquiries so newest is first
    const enqs = getLocalEnquiries();
    const sorted = [...enqs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEnquiries(sorted);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isDemo, refreshTrigger]);

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

    // Reschedule reminder times in DB using user input interval (reminderDays)
    dueEnquiries.forEach(e => {
      const newReminder = new Date();
      newReminder.setDate(now.getDate() + reminderDays); // delay by user input days

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

    // Refresh
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

  // Quick add note from dashboard
  const handleQuickAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteContent.trim()) return;

    const newNoteData = {
      content: quickNoteContent.trim(),
      stage: quickNoteStage,
      action_item: quickNoteStage,
      reminderDate: quickNoteReminder || undefined,
      is_completed: quickNoteStage === 'Converted'
    };

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            content: newNoteData.content,
            stage: newNoteData.stage,
            action_item: newNoteData.action_item,
            reminderDate: newNoteData.reminderDate || null,
            is_completed: newNoteData.is_completed,
            timestamp: new Date().toISOString()
          }])
          .select();
        if (!error && data && data.length > 0) {
          setNotes([data[0] as Note, ...notes]);
        } else {
          const localNote = saveLocalNote(newNoteData);
          setNotes([localNote, ...notes]);
        }
      } catch (err) {
        const localNote = saveLocalNote(newNoteData);
        setNotes([localNote, ...notes]);
      }
    } else {
      const localNote = saveLocalNote(newNoteData);
      setNotes([localNote, ...notes]);
    }

    setQuickNoteContent('');
    setQuickNoteReminder('');
    setQuickNoteStage('Reached Out');
    showToast('Note saved to dashboard!', 'success');
    onUpdate();
  };

  // Note stage update from dashboard
  const handleNoteStageChange = async (noteId: string, newStage: NoteStage) => {
    const isCompleted = newStage === 'Converted';
    const updates = {
      stage: newStage,
      action_item: newStage,
      is_completed: isCompleted
    };

    updateLocalNote(noteId, updates);
    setNotes(prev => prev.map(n => String(n.id) === String(noteId) ? { ...n, ...updates } : n));
    setOpenNoteDropdownId(null);

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('notes')
          .update({ stage: newStage, action_item: newStage, is_completed: isCompleted })
          .eq('id', noteId);
      } catch (err) {
        // Silently fall back to local storage
      }
    }
    showToast(`Stage updated to "${newStage}"`, 'success');
    onUpdate();
  };

  // Start editing a note from Dashboard
  const handleStartEditNote = (note: Note) => {
    setEditingNote(note);
    setEditNoteContent(note.content);
    setEditNoteStage(resolveNoteStage(note));
    setEditNoteReminder(note.reminderDate || '');
  };

  // Save edited note from Dashboard
  const handleSaveEditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editNoteContent.trim()) return;

    const updates = {
      content: editNoteContent.trim(),
      stage: editNoteStage,
      action_item: editNoteStage,
      reminderDate: editNoteReminder || undefined,
      is_completed: editNoteStage === 'Converted'
    };

    updateLocalNote(editingNote.id, updates);
    setNotes(prev => prev.map(n => String(n.id) === String(editingNote.id) ? { ...n, ...updates } : n));
    setEditingNote(null);
    showToast('Note updated successfully!', 'success');
    onUpdate();

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('notes')
          .update({
            content: updates.content,
            stage: updates.stage,
            action_item: updates.action_item,
            reminderDate: updates.reminderDate || null,
            is_completed: updates.is_completed
          })
          .eq('id', editingNote.id);
      } catch (err) {
        // Silently fall back to local storage
      }
    }
  };

  // Delete note from Dashboard
  const handleDeleteDashboardNote = async (noteId: string) => {
    deleteLocalNote(noteId);
    setNotes(prev => prev.filter(n => String(n.id) !== String(noteId)));
    showToast('Note deleted successfully!', 'success');
    onUpdate();

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);
      } catch (err) {
        // Silently fall back to local storage
      }
    }
  };

  // Note Stage Counts (5 requested stages from reference screenshot)
  const stageCounts: Record<NoteStage, number> = {
    'Reached Out': notes.filter(n => resolveNoteStage(n) === 'Reached Out').length,
    'Pipeline': notes.filter(n => resolveNoteStage(n) === 'Pipeline').length,
    'Converted': notes.filter(n => resolveNoteStage(n) === 'Converted').length,
    'To Be Follow Up': notes.filter(n => resolveNoteStage(n) === 'To Be Follow Up').length,
    'Delivery Due': notes.filter(n => resolveNoteStage(n) === 'Delivery Due').length
  };

  const stageList = DASHBOARD_STAGES.map(s => ({
    name: s,
    count: stageCounts[s]
  }));

  const maxStageCount = Math.max(...stageList.map(s => s.count), 1);
  const totalNotesCount = notes.length || 1;
  const conversionRate = Math.round((stageCounts['Converted'] / totalNotesCount) * 100);

  // Notes filtering and pagination
  const filteredDashboardNotes = notes.filter(n => {
    const stage = resolveNoteStage(n);
    const matchesStage = selectedNoteStageFilter === 'All' 
      ? true 
      : stage === selectedNoteStageFilter;
    const matchesQuery = noteSearchQuery.trim() === ''
      ? true
      : n.content.toLowerCase().includes(noteSearchQuery.toLowerCase());
    return matchesStage && matchesQuery;
  });

  const totalNotesPages = Math.ceil(filteredDashboardNotes.length / notesRowsPerPage) || 1;
  const paginatedDashboardNotes = filteredDashboardNotes.slice(
    (notesCurrentPage - 1) * notesRowsPerPage,
    notesCurrentPage * notesRowsPerPage
  );

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

  // Division breakdown
  const academyCategory = categories.find(c => c.name.toLowerCase().includes('academy'));
  const techCategory = categories.find(c => c.name.toLowerCase().includes('tech'));
  const academyCount = enquiries.filter(e => academyCategory && e.category_id === academyCategory.id).length;
  const techCount = enquiries.filter(e => techCategory && e.category_id === techCategory.id).length;
  const totalDiv = (academyCount + techCount) || 1;
  const techPercent = Math.round((techCount / totalDiv) * 100);
  const academyPercent = 100 - techPercent;

  // Top courses by interest
  const courseInterestCounts = courses
    .map(c => ({
      name: c.name,
      count: enquiries.filter(e => e.course_id === c.id).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const maxCourseCount = Math.max(...courseInterestCounts.map(c => c.count), 1);

  // Filtered action leads based on filter pills
  const filteredActionLeads = unresolvedEnquiries.filter(e => {
    if (actionFilter === 'unreachable') return e.can_follow_up === false;
    if (actionFilter === 'pending') return e.follow_up_done === null;
    return true;
  });

  const filteredAllEnquiries = enquiries
    .slice()
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

      {/* Overview Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
            {isSales ? 'Pipeline Overview' : 'Overview'}
          </h2>
          <span style={{ fontSize: '12.5px', color: '#5b7b88', fontWeight: 600 }}>
            {notes.length} notes entered in tracker
          </span>
        </div>

        {isSales ? (
          /* 5 Sales Stage Metric Cards matching the user's requested stages */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {DASHBOARD_STAGES.map((stg) => {
              const count = stageCounts[stg];
              const theme = DASHBOARD_STAGE_THEME[stg];
              const isSelected = selectedNoteStageFilter === stg;

              return (
                <div
                  key={stg}
                  onClick={() => {
                    setSelectedNoteStageFilter(isSelected ? 'All' : stg);
                    setNotesCurrentPage(1);
                  }}
                  className="glass-card"
                  style={{
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected ? `2px solid ${theme.color}` : '1px solid #cbe0e8',
                    backgroundColor: isSelected ? theme.bg : '#ffffff'
                  }}
                  title={`Filter dashboard notes by ${stg}`}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: theme.bg,
                      color: theme.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {stg === 'Reached Out' && <Phone size={20} />}
                    {stg === 'Pipeline' && <TrendingUp size={20} />}
                    {stg === 'Converted' && <CheckCircle size={20} />}
                    {stg === 'To Be Follow Up' && <Clock size={20} />}
                    {stg === 'Delivery Due' && <Package size={20} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                      {count}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#5b7b88', fontWeight: 600, marginTop: '2px' }}>
                      {stg}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Admin Overview Cards */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
            {/* Card 1: Unresolved leads */}
            <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box">
                <Package size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {unresolvedEnquiries.length}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Unresolved leads
                </div>
              </div>
            </div>

            {/* Card 2: Reminders due */}
            <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box">
                <Bell size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {dueReminderCount}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Reminders due
                </div>
              </div>
            </div>

            {/* Card 3: Total Notes Entered */}
            <div
              className="glass-card"
              style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
              onClick={() => onNavigateTab && onNavigateTab('notes')}
              title="View all entered notes"
            >
              <div className="metric-icon-box" style={{ backgroundColor: 'rgba(71, 121, 135, 0.15)', color: '#477987' }}>
                <BookOpen size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {notes.length}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Notes entered
                </div>
              </div>
            </div>

            {/* Card 4: Converted */}
            <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="metric-icon-box" style={{ backgroundColor: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {stageCounts['Converted']}
                </div>
                <div style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 600, marginTop: '3px' }}>
                  Converted
                </div>
              </div>
            </div>

            {/* Card 5: Not reachable (Peach Tinted Card) */}
            <div className="glass-card metric-card-peach" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
              <div className="metric-icon-box">
                <PhoneOff size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#162e3b', lineHeight: 1.1 }}>
                  {notReachableCount}
                </div>
                <div style={{ fontSize: '13px', color: '#78350f', fontWeight: 600, marginTop: '3px' }}>
                  Not reachable
                </div>
              </div>
              <Info size={16} style={{ position: 'absolute', bottom: '12px', right: '14px', color: '#ea580c', opacity: 0.6 }} />
            </div>
          </div>
        )}
      </div>

      {/* Middle Row (3-Column Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Column 1 */}
        {isSales ? (
          /* Quick Note Entry for Sales */
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', marginBottom: '8px' }}>
                Quick Note Entry
              </h3>
              <p style={{ fontSize: '13px', color: '#5b7b88', lineHeight: 1.45, margin: '0 0 14px 0' }}>
                Capture client conversation details immediately. The note appears instantly in the ledger below.
              </p>

              <form onSubmit={handleQuickAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  placeholder="Type note details here... (e.g. Spoke with client, confirmed interest in AI syllabus)"
                  value={quickNoteContent}
                  onChange={(e) => setQuickNoteContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '82px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbe0e8',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    value={quickNoteStage}
                    onChange={(e) => setQuickNoteStage(e.target.value as NoteStage)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbe0e8',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#162e3b'
                    }}
                  >
                    {DASHBOARD_STAGES.map(stg => (
                      <option key={stg} value={stg}>{stg}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={quickNoteReminder}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setQuickNoteReminder(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbe0e8',
                      fontSize: '12px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#162e3b'
                    }}
                    title="Optional reminder date"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!quickNoteContent.trim()}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#1f4854',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    border: 'none',
                    cursor: quickNoteContent.trim() ? 'pointer' : 'not-allowed',
                    opacity: quickNoteContent.trim() ? 1 : 0.6
                  }}
                >
                  <Send size={14} />
                  <span>Save Note to Dashboard</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Cron Job Simulator for Admin */
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
        )}

        {/* Column 2 */}
        {isSales ? (
          /* Conversion Rate & Distribution for Sales */
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', marginBottom: '14px' }}>
                Pipeline Conversion
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
                      stroke="#1ba37c"
                      strokeWidth="4"
                      strokeDasharray={`${conversionRate} ${100 - conversionRate}`}
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
                    <span style={{ fontSize: '16px', color: '#1ba37c' }}>{conversionRate}%</span>
                    <span style={{ fontSize: '11px', color: '#7a9aa7' }}>Converted</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eef4f7', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#1ba37c' }} />
                <span style={{ color: '#162e3b', fontWeight: 600 }}>Converted</span>
                <span style={{ color: '#7a9aa7', marginLeft: 'auto' }}>{stageCounts['Converted']} notes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#477987' }} />
                <span style={{ color: '#162e3b', fontWeight: 600 }}>Active in Pipeline</span>
                <span style={{ color: '#7a9aa7', marginLeft: 'auto' }}>{stageCounts['Pipeline']} notes</span>
              </div>
            </div>
          </div>
        ) : (
          /* Leads by division for Admin */
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
        )}

        {/* Column 3: The 5 Pipeline Stages Widget (Exact replica of user reference image) */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
              Top courses by interest
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#5b7b88' }}>
              {notes.length} notes
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stageList.map((stageItem, idx) => {
              const barWidthPercent = stageItem.count > 0 
                ? Math.max(12, Math.round((stageItem.count / maxStageCount) * 100)) 
                : 4;
              const isSelected = selectedNoteStageFilter === stageItem.name;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedNoteStageFilter(isSelected ? 'All' : stageItem.name);
                    setNotesCurrentPage(1);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    transition: 'all 0.15s ease',
                    backgroundColor: isSelected ? 'rgba(71, 121, 135, 0.12)' : 'transparent'
                  }}
                  title={`Filter notes by ${stageItem.name}`}
                >
                  <span
                    style={{
                      width: '130px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#162e3b',
                      fontWeight: 600,
                      textTransform: 'none'
                    }}
                    title={stageItem.name}
                  >
                    {stageItem.name}
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
                    {stageItem.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Customer Notes & Action Log (What was entered in notes displayed on Dashboard) */}
      <div className="glass-card" style={{ padding: '0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef4f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#162e3b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <BookOpen size={20} style={{ color: '#477987' }} />
              Customer Notes & Action Log ({filteredDashboardNotes.length})
            </h2>
            <p style={{ color: '#5b7b88', fontSize: '13px', margin: '3px 0 0 0' }}>
              Displaying notes and pipeline entries logged by the counseling team.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder="Search notes..."
                value={noteSearchQuery}
                onChange={(e) => { setNoteSearchQuery(e.target.value); setNotesCurrentPage(1); }}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbe0e8',
                  fontSize: '12.5px',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7a9aa7' }} />
            </div>

            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('notes')}
                className="btn btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#eef5f8',
                  color: '#1f4854',
                  border: '1px solid #cbe0e8'
                }}
              >
                <span>Open Recent Notes</span>
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Stage Filter Pills */}
        <div style={{ padding: '12px 24px', backgroundColor: '#fcfdfd', borderBottom: '1px solid #eef4f7', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#5b7b88', marginRight: '4px' }}>
            Filter:
          </span>
          <button
            onClick={() => { setSelectedNoteStageFilter('All'); setNotesCurrentPage(1); }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: selectedNoteStageFilter === 'All' ? '#1f4854' : '#ffffff',
              color: selectedNoteStageFilter === 'All' ? '#ffffff' : '#345967',
              border: selectedNoteStageFilter === 'All' ? 'none' : '1px solid #cbe0e8'
            }}
          >
            All ({notes.length})
          </button>
          {DASHBOARD_STAGES.map(stg => (
            <button
              key={stg}
              onClick={() => { setSelectedNoteStageFilter(stg); setNotesCurrentPage(1); }}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: selectedNoteStageFilter === stg ? DASHBOARD_STAGE_THEME[stg]?.color : '#ffffff',
                color: selectedNoteStageFilter === stg ? '#ffffff' : DASHBOARD_STAGE_THEME[stg]?.color,
                border: `1px solid ${DASHBOARD_STAGE_THEME[stg]?.color}`,
                boxShadow: selectedNoteStageFilter === stg ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {stg} ({stageCounts[stg]})
            </button>
          ))}
        </div>

        {/* Notes Table */}
        <div className="table-wrapper" style={{ overflow: 'visible' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Created Date</th>
                <th style={{ width: '130px' }}>Reminder Due</th>
                <th>Note Content</th>
                <th style={{ width: '170px' }}>Pipeline Stage</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDashboardNotes.map(n => {
                const stage = resolveNoteStage(n);
                const theme = DASHBOARD_STAGE_THEME[stage] || DASHBOARD_STAGE_THEME['Reached Out'];
                const isOpen = openNoteDropdownId === n.id;

                return (
                  <tr key={n.id}>
                    <td style={{ fontSize: '13px', color: '#5b7b88', fontWeight: 500, verticalAlign: 'top' }}>
                      {new Date(n.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      {n.reminderDate ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          backgroundColor: 'rgba(2, 132, 199, 0.1)',
                          color: '#0284c7',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          <Calendar size={12} />
                          {new Date(n.reminderDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>
                      ) : (
                        <span style={{ color: '#a0b6c0', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontSize: '13.5px', color: '#162e3b', fontWeight: 500, lineHeight: 1.5, verticalAlign: 'top', whiteSpace: 'pre-wrap', maxWidth: '400px' }}>
                      {n.content}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="dashboard-note-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenNoteDropdownId(isOpen ? null : n.id);
                          }}
                          className="btn"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.bg,
                            color: theme.color,
                            outline: 'none',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span>{stage}</span>
                          <ChevronDown size={12} style={{ opacity: 0.7 }} />
                        </button>

                        {isOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              zIndex: 100,
                              minWidth: '150px',
                              padding: '6px',
                              borderRadius: '8px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbe0e8',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {DASHBOARD_STAGES.map(stg => (
                              <button
                                key={stg}
                                type="button"
                                onClick={() => handleNoteStageChange(n.id, stg)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%',
                                  padding: '6px 10px',
                                  borderRadius: '5px',
                                  border: 'none',
                                  background: stage === stg ? DASHBOARD_STAGE_THEME[stg].bg : 'transparent',
                                  color: stage === stg ? DASHBOARD_STAGE_THEME[stg].color : '#162e3b',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <span>{stg}</span>
                                {stage === stg && <Check size={12} style={{ color: DASHBOARD_STAGE_THEME[stg].color }} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(n)}
                          className="btn btn-ghost btn-icon"
                          style={{ width: '30px', height: '30px', padding: 0, color: '#477987' }}
                          title="Edit Note"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDashboardNote(n.id)}
                          className="btn btn-ghost btn-icon hover-danger"
                          style={{ width: '30px', height: '30px', padding: 0, color: '#dc2626' }}
                          title="Delete Note"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedDashboardNotes.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#5b7b88' }}>
                    No notes found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalNotesPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid #eef4f7' }}>
            <span style={{ fontSize: '13px', color: '#5b7b88' }}>
              Page {notesCurrentPage} of {totalNotesPages}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setNotesCurrentPage(p => Math.max(1, p - 1))}
                disabled={notesCurrentPage === 1}
                className="btn btn-ghost btn-icon"
                style={{ width: '30px', height: '30px', opacity: notesCurrentPage === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setNotesCurrentPage(p => Math.min(totalNotesPages, p + 1))}
                disabled={notesCurrentPage === totalNotesPages}
                className="btn btn-ghost btn-icon"
                style={{ width: '30px', height: '30px', opacity: notesCurrentPage === totalNotesPages ? 0.5 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Leads board requiring action (Admin only - Sales dashboard focuses on customer notes) */}
      {!isSales && (
        <>
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Database table showing everything */}
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
                    <td style={{ fontWeight: 600 }}>{e.contact_name}</td>
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
                        {/* Render miniature badges */}
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
    </>
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
            zIndex: 1000,
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                    Course Choice *
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingEnquiry.course_id}
                    onChange={e => {
                      const selectedCourse = courses.find(c => c.id === e.target.value);
                      setEditingEnquiry({
                        ...editingEnquiry,
                        course_id: e.target.value,
                        category_id: selectedCourse ? selectedCourse.category_id : editingEnquiry.category_id
                      });
                    }}
                    required
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.fee})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, marginTop: '34px', color: 'hsl(var(--foreground))' }}>
                    <input
                      type="checkbox"
                      checked={editingEnquiry.fee_shared}
                      onChange={e => setEditingEnquiry({ ...editingEnquiry, fee_shared: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))', borderRadius: '4px' }}
                    />
                    Details Shared with Lead
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                    Payment Status
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingEnquiry.payment || 'Pending'}
                    onChange={e => setEditingEnquiry({ ...editingEnquiry, payment: e.target.value })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                    Next Reminder Due Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                    value={editingEnquiry.next_reminder_at ? editingEnquiry.next_reminder_at.substring(0, 10) : ''}
                    onChange={e => {
                      if (e.target.value) {
                        const d = new Date(e.target.value);
                        setEditingEnquiry({ ...editingEnquiry, next_reminder_at: d.toISOString() });
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '8px' }}>
                  Notes
                </label>
                <textarea
                  className="form-textarea"
                  style={{ width: '100%', minHeight: '90px', padding: '12px 14px', borderRadius: '8px', background: 'hsl(var(--background))', fontFamily: 'inherit', resize: 'vertical' }}
                  value={editingEnquiry.notes || ''}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, notes: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid hsl(var(--card-border))', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'hsl(var(--foreground))' }}>
                  Tracking Checklist Statuses
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '6px' }}>
                      Interested
                    </label>
                    <select
                      className="form-select"
                      style={{ width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                      value={editingEnquiry.interested === null ? 'null' : editingEnquiry.interested ? 'true' : 'false'}
                      onChange={e => {
                        const val = e.target.value === 'null' ? null : e.target.value === 'true';
                        setEditingEnquiry({ ...editingEnquiry, interested: val });
                      }}
                    >
                      <option value="null">Pending (?)</option>
                      <option value="true">Yes (✓)</option>
                      <option value="false">No (✕)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '6px' }}>
                      Follow-up Done
                    </label>
                    <select
                      className="form-select"
                      style={{ width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                      value={editingEnquiry.follow_up_done === null ? 'null' : editingEnquiry.follow_up_done ? 'true' : 'false'}
                      onChange={e => {
                        const val = e.target.value === 'null' ? null : e.target.value === 'true';
                        setEditingEnquiry({ ...editingEnquiry, follow_up_done: val });
                      }}
                    >
                      <option value="null">Pending (?)</option>
                      <option value="true">Yes (✓)</option>
                      <option value="false">No (✕)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: '6px' }}>
                      Reachable
                    </label>
                    <select
                      className="form-select"
                      style={{ width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', background: 'hsl(var(--background))' }}
                      value={editingEnquiry.can_follow_up === null ? 'null' : editingEnquiry.can_follow_up ? 'true' : 'false'}
                      onChange={e => {
                        const val = e.target.value === 'null' ? null : e.target.value === 'true';
                        setEditingEnquiry({ ...editingEnquiry, can_follow_up: val });
                      }}
                    >
                      <option value="null">Pending (?)</option>
                      <option value="true">Yes (✓)</option>
                      <option value="false">No (✕)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setEditingEnquiry(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'hsl(var(--foreground))',
                    fontWeight: 500,
                    fontSize: '15px',
                    padding: '8px 12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '15px' }}
                >
                  <Save size={18} /> {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Note Modal for Dashboard */}
      {editingNote && (
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
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbe0e8',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.18)',
              padding: '24px 28px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eef5f8', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit size={20} style={{ color: '#477987' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
                  Edit Customer Note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px', color: '#7a9aa7' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#162e3b', marginBottom: '8px' }}>
                  Note Content *
                </label>
                <textarea
                  value={editNoteContent}
                  onChange={(e) => setEditNoteContent(e.target.value)}
                  rows={4}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbe0e8',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical',
                    backgroundColor: '#fcfdfd'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#162e3b', marginBottom: '8px' }}>
                    Pipeline Stage
                  </label>
                  <select
                    value={editNoteStage}
                    onChange={(e) => setEditNoteStage(e.target.value as NoteStage)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbe0e8',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#fcfdfd'
                    }}
                  >
                    {DASHBOARD_STAGES.map(stg => (
                      <option key={stg} value={stg}>{stg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#162e3b', marginBottom: '8px' }}>
                    Reminder Due Date
                  </label>
                  <input
                    type="date"
                    value={editNoteReminder}
                    onChange={(e) => setEditNoteReminder(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbe0e8',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#fcfdfd'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid #eef5f8' }}>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#5b7b88',
                    fontWeight: 600,
                    fontSize: '14px',
                    padding: '8px 14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editNoteContent.trim()}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '14px',
                    backgroundColor: '#1f4854',
                    color: '#ffffff',
                    border: 'none',
                    cursor: editNoteContent.trim() ? 'pointer' : 'not-allowed',
                    opacity: editNoteContent.trim() ? 1 : 0.6
                  }}
                >
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};
export default Dashboard;
