import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Calendar, 
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Check,
  Edit,
  Phone
} from 'lucide-react';
import { 
  getLocalNotes, 
  updateLocalNote,
  type Note
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface PendingNotesProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
}

export const PendingNotes: React.FC<PendingNotesProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'due3' | 'later' | 'completed'>('all');

  const fetchPendingData = async () => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: nts, error } = await supabase.from('notes').select('*');
        if (!error && nts) {
          setNotes(nts as Note[]);
        } else {
          console.error("Error fetching pending notes from Supabase:", error);
          setNotes(getLocalNotes());
        }
      } catch (err) {
        console.error('Error loading pending notes:', err);
        setNotes(getLocalNotes());
      }
    } else {
      setNotes(getLocalNotes());
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, [isDemo, refreshTrigger]);

  // A note is pending if it has a reminderDate and is not completed
  const unresolvedNotes = notes.filter(n => n.reminderDate && !n.is_completed);
  const completedNotes = notes.filter(n => n.is_completed);

  const now = new Date();
  
  const getAlertStatus = (reminderIso: string) => {
    const reminderDate = new Date(reminderIso);
    const diffMs = reminderDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const pastDays = Math.abs(diffDays);
      return { 
        code: 'overdue', 
        label: `Overdue by ${pastDays} ${pastDays === 1 ? 'day' : 'days'}`, 
        color: 'hsl(var(--danger))',
        bg: 'hsl(var(--danger) / 0.12)',
        days: diffDays
      };
    } else if (diffDays === 0) {
      return { 
        code: 'today', 
        label: 'Due Today', 
        color: 'hsl(var(--warning))',
        bg: 'hsl(var(--warning) / 0.15)',
        days: 0
      };
    } else {
      return { 
        code: 'future', 
        label: `Due in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`, 
        color: 'hsl(var(--primary))',
        bg: 'hsl(var(--primary) / 0.12)',
        days: diffDays
      };
    }
  };

  const filteredNotes = (filterTab === 'completed' ? completedNotes : unresolvedNotes).filter(note => {
    const status = note.reminderDate ? getAlertStatus(note.reminderDate) : null;

    if (filterTab !== 'completed' && status) {
      if (filterTab === 'overdue' && status.code !== 'overdue' && status.code !== 'today') return false;
      if (filterTab === 'due3' && (status.days < 0 || status.days > 3)) return false;
      if (filterTab === 'later' && status.days <= 3) return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return note.content.toLowerCase().includes(q);
    }

    return true;
  });

  const handleMarkCompleted = async (note: Note) => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      await supabase.from('notes').update({
        is_completed: true
      }).eq('id', note.id);
    } else {
      updateLocalNote(note.id, {
        is_completed: true
      });
    }

    fetchPendingData();
    onUpdate();
  };

  const overdueCount = unresolvedNotes.filter(n => n.reminderDate && (getAlertStatus(n.reminderDate).code === 'overdue' || getAlertStatus(n.reminderDate).code === 'today')).length;
  const dueNext3Count = unresolvedNotes.filter(n => {
    if (!n.reminderDate) return false;
    const st = getAlertStatus(n.reminderDate);
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
            <span style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Total Pending Notes</span>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>{unresolvedNotes.length}</h3>
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTab('all')}
            className={`btn ${filterTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            All Pending ({unresolvedNotes.length})
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
            Completed ({completedNotes.length})
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search notes..."
            style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredNotes.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--muted))' }}>
            <CheckCircle size={40} style={{ color: 'hsl(var(--success))', display: 'block', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: '4px' }}>
              {filterTab === 'completed' ? 'No Completed Notes Yet' : 'No Pending Notes Found'}
            </h4>
            <p style={{ fontSize: '13px' }}>
              {searchTerm ? 'No pending notes match your search filter.' : 'Great job! All notes are up to date.'}
            </p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const alertStatus = note.reminderDate ? getAlertStatus(note.reminderDate) : null;
            const reminderDateFormatted = note.reminderDate ? new Date(note.reminderDate).toLocaleDateString([], { 
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            }) : 'No reminder';

            return (
              <div 
                key={note.id} 
                className="glass-card"
                style={{ 
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  borderLeft: `4px solid ${filterTab === 'completed' ? '#16a34a' : (alertStatus?.color || 'transparent')}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
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
                        flexShrink: 0
                      }}
                    >
                      <BookOpen size={18} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {filterTab !== 'completed' && alertStatus && (
                          <span 
                            style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              padding: '3px 10px', 
                              borderRadius: '12px',
                              color: alertStatus.color,
                              backgroundColor: alertStatus.bg,
                              border: `1px solid ${alertStatus.color}33`
                            }}
                          >
                            {alertStatus.label}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'hsl(var(--muted))' }}>
                           Due: <strong style={{ color: 'hsl(var(--foreground))' }}>{reminderDateFormatted}</strong>
                        </span>
                      </div>
                      
                      <div style={{ whiteSpace: 'pre-wrap', color: 'hsl(var(--foreground))', fontSize: '14px', lineHeight: '1.6' }}>
                        {note.content}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {filterTab !== 'completed' ? (
                      <button
                        onClick={() => handleMarkCompleted(note)}
                        className="btn"
                        title="Mark Note as Completed"
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
                          cursor: 'pointer'
                        }}
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
                    ) : (
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
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PendingNotes;
