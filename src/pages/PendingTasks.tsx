import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Calendar, 
  Clock, 
  Edit, 
  Check,
  CheckCircle, 
  AlertTriangle,
  User,
  Phone,
  BookOpen,
  ChevronRight,
  RefreshCw,
  X,
  Save
} from 'lucide-react';
import { 
  getLocalEnquiries, 
  getLocalCourses, 
  getLocalCategories,
  updateLocalEnquiry
} from '../lib/localDatabase';
import type { Enquiry, Course, Category } from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface PendingTasksProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateHome?: () => void;
}

export const PendingTasks: React.FC<PendingTasksProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate
}) => {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'due3' | 'later' | 'completed'>('all');
  
  // Edit Lead Modal State
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchPendingData = async () => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: cats } = await supabase.from('categories').select('*');
        const { data: crs } = await supabase.from('courses').select('*');
        const { data: enqs } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });
        
        if (cats) setCategories(cats);
        if (crs) setCourses(crs);
        if (enqs) setEnquiries(enqs);
      } catch (err) {
        console.error('Error loading pending tasks:', err);
      }
    } else {
      setCategories(getLocalCategories());
      setCourses(getLocalCourses());
      setEnquiries(getLocalEnquiries());
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, [isDemo, refreshTrigger]);

  // Filter unresolved tasks and ensure newly created leads display on TOP of the list
  const unresolvedTasks = enquiries
    .filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Completed tasks — all checklist fields are set (non-null) sorted by most recent
  const completedTasks = enquiries
    .filter(e => e.interested !== null && e.follow_up_done !== null && e.can_follow_up !== null)
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

  const now = new Date();
  
  // Calculate alert days for each lead
  const getAlertStatus = (nextReminderIso: string) => {
    const reminderDate = new Date(nextReminderIso);
    const diffMs = reminderDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const pastDays = Math.abs(diffDays);
      return { 
        code: 'overdue', 
        label: `Overdue by ${pastDays} ${pastDays === 1 ? 'day' : 'days'}`, 
        color: '#e11d48',
        bg: '#ffe4e6',
        days: diffDays
      };
    } else if (diffDays === 0) {
      return { 
        code: 'today', 
        label: 'Due Today', 
        color: '#d97706',
        bg: '#fef3c7',
        days: 0
      };
    } else {
      return { 
        code: 'future', 
        label: `Due in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`, 
        color: '#2563eb',
        bg: '#dbeafe',
        days: diffDays
      };
    }
  };

  // Filter based on selected tab & search term
  const filteredTasks = (filterTab === 'completed' ? completedTasks : unresolvedTasks).filter(task => {
    const status = getAlertStatus(task.next_reminder_at);

    // Tab filter (only applies to pending tabs)
    if (filterTab !== 'completed') {
      if (filterTab === 'overdue' && status.code !== 'overdue' && status.code !== 'today') return false;
      if (filterTab === 'due3' && (status.days < 0 || status.days > 3)) return false;
      if (filterTab === 'later' && status.days <= 3) return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const course = courses.find(c => c.id === task.course_id);
      const nameMatch = task.contact_name.toLowerCase().includes(q);
      const phoneMatch = task.contact_phone?.toLowerCase().includes(q);
      const courseMatch = course?.name.toLowerCase().includes(q);
      return nameMatch || phoneMatch || courseMatch;
    }

    return true;
  });

  // Handle Mark Completed (sets checklist items complete)
  const handleMarkCompleted = async (task: Enquiry) => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      await supabase.from('enquiries').update({
        interested: true,
        follow_up_done: true,
        can_follow_up: true,
        updated_at: new Date().toISOString()
      }).eq('id', task.id);
    } else {
      updateLocalEnquiry(task.id, {
        interested: true,
        follow_up_done: true,
        can_follow_up: true
      });
    }

    fetchPendingData();
    onUpdate();
  };

  // Handle Quick Reschedule (Snooze alert)
  const handleQuickSnooze = async (task: Enquiry, daysToAdd: number) => {
    const newDate = new Date();
    newDate.setDate(now.getDate() + daysToAdd);

    if (!isDemo && isSupabaseConfigured() && supabase) {
      await supabase.from('enquiries').update({
        next_reminder_at: newDate.toISOString(),
        updated_at: now.toISOString()
      }).eq('id', task.id);
    } else {
      updateLocalEnquiry(task.id, {
        next_reminder_at: newDate.toISOString()
      });
    }

    fetchPendingData();
    onUpdate();
  };

  // Save Modal Edit
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
      fetchPendingData();
      onUpdate();
    } catch (err: any) {
      alert(`Failed to save edit: ${err.message || err}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Counts for summary metrics
  const overdueCount = unresolvedTasks.filter(t => getAlertStatus(t.next_reminder_at).code === 'overdue' || getAlertStatus(t.next_reminder_at).code === 'today').length;
  const dueNext3Count = unresolvedTasks.filter(t => {
    const st = getAlertStatus(t.next_reminder_at);
    return st.days >= 0 && st.days <= 3;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
            <Bell size={22} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Total Pending Tasks</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>{unresolvedTasks.length}</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'hsl(var(--danger) / 0.12)', color: 'hsl(var(--danger))' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Overdue / Due Today</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: overdueCount > 0 ? 'hsl(var(--danger))' : 'hsl(var(--success))' }}>
              {overdueCount}
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'hsl(var(--warning) / 0.12)', color: 'hsl(var(--warning))' }}>
            <Calendar size={22} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Due in Next 3 Days</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'hsl(var(--warning))' }}>{dueNext3Count}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div 
        className="glass-card"
        style={{ 
          padding: '16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: '12px' 
        }}
      >
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTab('all')}
            className={`btn ${filterTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            All Pending ({unresolvedTasks.length})
          </button>
          <button
            onClick={() => setFilterTab('overdue')}
            className={`btn ${filterTab === 'overdue' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Overdue / Today ({overdueCount})
          </button>
          <button
            onClick={() => setFilterTab('due3')}
            className={`btn ${filterTab === 'due3' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Next 3 Days ({dueNext3Count})
          </button>
          <button
            onClick={() => setFilterTab('later')}
            className={`btn ${filterTab === 'later' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Due Later
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`btn ${filterTab === 'completed' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCircle size={13} />
            Completed ({completedTasks.length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search lead name or phone..."
            style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredTasks.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--muted))' }}>
            <CheckCircle size={40} style={{ color: 'hsl(var(--success))', display: 'block', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: '4px' }}>
              {filterTab === 'completed' ? 'No Completed Tasks Yet' : 'No Pending Tasks Found'}
            </h4>
            <p style={{ fontSize: '13px' }}>
              {filterTab === 'completed'
                ? 'Tasks you mark as done will appear here.'
                : searchTerm ? 'No pending tasks match your search filter.' : 'Great job! All lead follow-ups are up to date.'}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const course = courses.find(c => c.id === task.course_id);
            const alertStatus = getAlertStatus(task.next_reminder_at);
            const reminderDateFormatted = new Date(task.next_reminder_at).toLocaleDateString([], { 
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            });

            return (
              <div 
                key={task.id} 
                className="glass-card"
                style={{ 
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  borderLeft: `4px solid ${filterTab === 'completed' ? '#16a34a' : alertStatus.color}`,
                  overflow: 'hidden',
                  background: 'hsl(var(--card))'
                }}
              >
                {/* Header row of card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  
                  {/* Lead Info */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div 
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        backgroundColor: 'hsl(var(--primary) / 0.12)', 
                        color: 'hsl(var(--primary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '16px',
                        flexShrink: 0
                      }}
                    >
                      {task.contact_name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
                          {task.contact_name}
                        </h3>
                        {filterTab !== 'completed' && (
                          <span 
                            style={{ 
                              fontSize: '11px', 
                              fontWeight: 600, 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              color: alertStatus.color,
                              backgroundColor: alertStatus.bg,
                            }}
                          >
                            {alertStatus.label}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'hsl(var(--muted))', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={13} /> {task.contact_phone || 'No phone'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <BookOpen size={13} /> {course?.name || 'Course'} ({course?.fee || 'N/A'})
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} /> Alert Due: <strong style={{ color: 'hsl(var(--foreground))' }}>{reminderDateFormatted}</strong>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Details: <strong style={{ color: task.fee_shared ? '#16a34a' : 'hsl(var(--muted))' }}>{task.fee_shared ? 'Shared' : 'Pending'}</strong>
                        </span>
                        {task.payment && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Payment: <strong style={{ 
                              color: task.payment === 'Completed' ? '#16a34a' : task.payment === 'Partially Paid' ? '#d97706' : 'hsl(var(--muted))' 
                            }}>{task.payment}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Right: Done Icon + Edit Task Icon */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    
                    {filterTab !== 'completed' && (
                      /* Green Done Button with White Check inside */
                      <button
                        onClick={() => handleMarkCompleted(task)}
                        className="btn"
                        title="Mark Task as Completed"
                        style={{ 
                          padding: '6px 14px', 
                          fontSize: '12px', 
                          fontWeight: 700,
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <div 
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            borderRadius: '50%', 
                            backgroundColor: '#ffffff', 
                            color: '#16a34a', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center'
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span>Done</span>
                      </button>
                    )}

                    {filterTab === 'completed' && (
                      /* Completed badge shown instead of Done button */
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#16a34a',
                          backgroundColor: 'rgba(22, 163, 74, 0.12)',
                          border: '1px solid rgba(22, 163, 74, 0.3)',
                          borderRadius: '8px',
                          padding: '5px 12px'
                        }}
                      >
                        <CheckCircle size={14} /> Completed
                      </span>
                    )}

                    {/* Edit Task Button */}
                    <button
                      onClick={() => setEditingEnquiry(task)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit size={14} /> Edit Task
                    </button>
                  </div>
                </div>

                {/* Notes if available */}
                {task.notes && (
                  <div 
                    style={{ 
                      padding: '10px 14px', 
                      borderRadius: '6px', 
                      backgroundColor: 'hsl(var(--background) / 0.5)', 
                      fontSize: '12px', 
                      color: 'hsl(var(--foreground))',
                      fontStyle: 'italic',
                      border: '1px solid hsl(var(--card-border))'
                    }}
                  >
                    "{task.notes}"
                  </div>
                )}

                {/* Status checklist + Quick Snooze Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid hsl(var(--card-border))', paddingTop: '12px' }}>
                  
                  {/* Checklist pills */}
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                    <span>
                      Interested: <strong style={{ color: task.interested === true ? '#16a34a' : task.interested === false ? '#ef4444' : 'hsl(var(--foreground))' }}>{task.interested === null ? 'Pending (?)' : task.interested ? 'Yes ✓' : 'No ✕'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Follow-up: <strong style={{ color: task.follow_up_done === true ? '#16a34a' : task.follow_up_done === false ? '#ef4444' : 'hsl(var(--foreground))' }}>{task.follow_up_done === null ? 'Pending (?)' : task.follow_up_done ? 'Yes ✓' : 'No ✕'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Reachable: <strong style={{ color: task.can_follow_up === true ? '#16a34a' : task.can_follow_up === false ? '#ef4444' : 'hsl(var(--foreground))' }}>{task.can_follow_up === null ? 'Pending (?)' : task.can_follow_up ? 'Yes ✓' : 'No ✕'}</strong>
                    </span>
                  </div>

                  {/* Quick Reschedule Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(var(--muted))' }}>Snooze Alert:</span>
                    <button
                      onClick={() => handleQuickSnooze(task, 1)}
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      +1 Day
                    </button>
                    <button
                      onClick={() => handleQuickSnooze(task, 3)}
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      +3 Days
                    </button>
                    <button
                      onClick={() => handleQuickSnooze(task, 7)}
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      +7 Days
                    </button>
                  </div>

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* EDIT TASK MODAL */}
      {editingEnquiry && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            className="glass-card" 
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid hsl(var(--card-border))',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
                Edit Pending Task Details
              </h3>
              <button 
                onClick={() => setEditingEnquiry(null)}
                className="btn btn-ghost btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px' }}>
                  Customer Name
                </label>
                <input 
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={editingEnquiry.contact_name}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, contact_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input 
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    value={editingEnquiry.contact_phone || ''}
                    onChange={e => setEditingEnquiry({ ...editingEnquiry, contact_phone: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px' }}>
                    Course Choice
                  </label>
                  <select 
                    className="input"
                    style={{ width: '100%', background: 'hsl(var(--background))' }}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginTop: '24px' }}>
                    <input 
                      type="checkbox"
                      checked={editingEnquiry.fee_shared}
                      onChange={e => setEditingEnquiry({ ...editingEnquiry, fee_shared: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
                    />
                    Details Shared with Lead
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px' }}>
                    Payment Status
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%', background: 'hsl(var(--background))' }}
                    value={editingEnquiry.payment || 'Pending'}
                    onChange={e => setEditingEnquiry({ ...editingEnquiry, payment: e.target.value })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px' }}>
                    Next Alert Due Date
                  </label>
                  <input 
                    type="date"
                    className="input"
                    style={{ width: '100%', background: 'hsl(var(--background))' }}
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px' }}>
                  Notes
                </label>
                <textarea 
                  className="input"
                  style={{ width: '100%', minHeight: '70px', fontFamily: 'inherit' }}
                  value={editingEnquiry.notes || ''}
                  onChange={e => setEditingEnquiry({ ...editingEnquiry, notes: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid hsl(var(--card-border))', paddingTop: '14px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>
                  Tracking Checklist Statuses
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                      Interested
                    </label>
                    <select 
                      className="input"
                      style={{ width: '100%', fontSize: '12px', background: 'hsl(var(--background))' }}
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                      Follow-up Done
                    </label>
                    <select 
                      className="input"
                      style={{ width: '100%', fontSize: '12px', background: 'hsl(var(--background))' }}
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                      Reachable
                    </label>
                    <select 
                      className="input"
                      style={{ width: '100%', fontSize: '12px', background: 'hsl(var(--background))' }}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button 
                  type="button"
                  onClick={() => setEditingEnquiry(null)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={16} />
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PendingTasks;
