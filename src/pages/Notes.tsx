import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, BookOpen, Calendar, Edit2, Trash2, X, Check, Mic, ChevronDown, CheckCircle2, RotateCcw } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getLocalNotes, saveLocalNote, updateLocalNote, deleteLocalNote, type Note, type UserSession } from '../lib/localDatabase';

export type AdminActionStatus = 'Pending' | 'Completed';

export const ACTION_STATUS_THEME: Record<AdminActionStatus, { bg: string; color: string; border: string }> = {
  'Pending': { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.35)' },
  'Completed': { bg: 'rgba(27, 163, 124, 0.12)', color: '#1ba37c', border: 'rgba(27, 163, 124, 0.35)' }
};

interface NotesProps {
  currentUser?: UserSession | null;
  onUpdate?: () => void;
  searchQuery?: string;
}

const Notes: React.FC<NotesProps> = ({ currentUser, onUpdate, searchQuery }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AdminActionStatus>('Pending');
  const [statusFilter, setStatusFilter] = useState<'All' | AdminActionStatus>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [shouldAutoSave, setShouldAutoSave] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editReminderDate, setEditReminderDate] = useState('');
  const [editStatus, setEditStatus] = useState<AdminActionStatus>('Pending');

  // Action status dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    if (shouldAutoSave) {
      if (currentNote.trim()) {
        handleAddNote();
      }
      setShouldAutoSave(false);
    }
  }, [shouldAutoSave]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setCurrentNote((prev) => {
            const space = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + space + finalTranscript.trim();
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setShouldAutoSave(true);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-item-dropdown-container')) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownId]);

  const isSalesUser = currentUser?.role === 'sales';
  const targetRole = isSalesUser ? 'sales' : 'admin';
  const targetCreator = isSalesUser ? (currentUser?.name || 'Sales Desk') : 'Admin';

  const fetchNotes = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('role', targetRole)
          .order('timestamp', { ascending: false });
          
        if (!error && data) {
          const cleanNotes = (data as Note[]).filter(n => {
            if (isSalesUser) {
              return n.role === 'sales' && n.created_by !== 'Admin';
            }
            return n.role !== 'sales' && !String(n.id).startsWith('sales-note-') && n.created_by !== 'Sales Desk';
          });
          setNotes(cleanNotes);
        } else {
          setNotes(getLocalNotes(targetRole));
        }
      } catch (err) {
        setNotes(getLocalNotes(targetRole));
      }
    } else {
      setNotes(getLocalNotes(targetRole));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotes();
  }, [currentUser]);

  const handleStatusChange = async (note: Note, newStatus: AdminActionStatus) => {
    const isCompleted = newStatus === 'Completed';
    const updates = {
      action_item: newStatus,
      is_completed: isCompleted
    };

    updateLocalNote(note.id, updates, targetRole);
    setNotes(prev => prev.map(n => String(n.id) === String(note.id) ? { ...n, ...updates } : n));
    setOpenDropdownId(null);
    onUpdate?.();

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('notes')
          .update({ is_completed: isCompleted, action_item: newStatus })
          .eq('id', note.id);
      } catch (err) {
        // Silently fall back to local storage
      }
    }
  };

  const handleAddNote = async () => {
    if (isSubmitting || !currentNote.trim()) return;
    
    setIsSubmitting(true);
    try {
      const isCompleted = selectedStatus === 'Completed';
      const noteId = 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      const nowIso = new Date().toISOString();
      const newNoteData = {
        id: noteId,
        content: currentNote.trim(),
        reminderDate: reminderDate || undefined,
        action_item: selectedStatus,
        is_completed: isCompleted,
        role: targetRole,
        created_by: targetCreator,
        timestamp: nowIso
      };
      
      const saved = saveLocalNote(newNoteData, targetRole);
      setNotes(prev => [saved, ...prev.filter(n => n.id !== saved.id && n.content.trim().toLowerCase() !== saved.content.trim().toLowerCase())]);
      
      setCurrentNote('');
      setReminderDate('');
      setSelectedStatus('Pending');
      onUpdate?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditReminderDate(note.reminderDate || '');
    setEditStatus((note.is_completed || note.action_item === 'Completed') ? 'Completed' : 'Pending');
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditContent('');
    setEditReminderDate('');
    setEditStatus('Pending');
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editContent.trim()) return;
    
    const isCompleted = editStatus === 'Completed';
    const updates = {
      content: editContent.trim(),
      reminderDate: editReminderDate || undefined,
      action_item: editStatus,
      is_completed: isCompleted
    };

    updateLocalNote(editingNoteId, updates, 'admin');
    setNotes(prev => prev.map(n => String(n.id) === String(editingNoteId) ? { ...n, ...updates } : n));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('notes')
          .update({
            content: updates.content,
            reminderDate: updates.reminderDate || null,
            action_item: editStatus,
            is_completed: isCompleted
          })
          .eq('id', editingNoteId);
      } catch (err) {
        // Silently fall back to local storage
      }
    }
    cancelEditing();
    onUpdate?.();
  };

  const handleDeleteNote = async (id: string) => {
    deleteLocalNote(id, 'admin');
    setNotes(prev => prev.filter(n => String(n.id) !== String(id)));
    onUpdate?.();

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('notes')
          .delete()
          .eq('id', id);
      } catch (err) {
        // Silently fall back to local storage
      }
    }
  };

  // Status counts (Strictly Admin Pending / Completed)
  const pendingNotesCount = notes.filter(n => !n.is_completed && n.action_item !== 'Completed').length;
  const completedNotesCount = notes.filter(n => n.is_completed || n.action_item === 'Completed').length;

  const filteredNotes = notes.filter(n => {
    const isCompleted = Boolean(n.is_completed || n.action_item === 'Completed');
    if (statusFilter === 'Pending' && isCompleted) return false;
    if (statusFilter === 'Completed' && !isCompleted) return false;
    
    const q = (searchQuery || '').toLowerCase().trim();
    if (q && !n.content.toLowerCase().includes(q)) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredNotes.length / rowsPerPage) || 1;
  const paginatedNotes = filteredNotes.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.4s ease-out' }}>
      
      {/* Input Section */}
      <div className="glass-card">
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="brand-icon" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '800', 
              background: 'linear-gradient(135deg, hsl(var(--foreground)) 60%, hsl(var(--primary)))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 4px 0'
            }}>
              Recent Notes
            </h2>
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px', margin: 0 }}>
              Record administrative, operational, facility, and compliance notes.
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div 
            style={{ 
              position: 'relative', 
              borderRadius: '12px',
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--card-border))',
              transition: 'all 0.3s ease',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
            }}
            className="note-input-container"
          >
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Type administrative note here... (e.g. Annual campus safety audit scheduled with municipal authority, server backup log verified)"
              className="form-textarea"
              style={{
                minHeight: '140px',
                resize: 'vertical',
                border: 'none',
                background: 'transparent',
                padding: '20px',
                paddingBottom: '60px',
                width: '100%',
                fontSize: '15px',
                lineHeight: '1.6'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleAddNote();
                }
              }}
            />
            
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Action Item Status Selector (Pending / Completed) */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as AdminActionStatus)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--card-border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                  title="Action Item Status"
                >
                  <option value="Pending">Pending Action</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Reminder / Follow-up Date Selector (Optional) */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} title="Follow-up Date (Optional - leave blank if none)">
                <input 
                  type="date"
                  value={reminderDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setReminderDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    paddingLeft: '32px',
                    paddingRight: reminderDate ? '28px' : '68px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--card-border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit'
                  }}
                  className="reminder-date-input"
                  title="Follow-up Date (Optional)"
                />
                <Calendar size={14} style={{ position: 'absolute', left: '10px', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
                {reminderDate ? (
                  <button
                    type="button"
                    onClick={() => setReminderDate('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      color: 'hsl(var(--muted-foreground))',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%'
                    }}
                    title="Clear date (leave optional)"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <span style={{ position: 'absolute', right: '10px', fontSize: '11px', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none', opacity: 0.75 }}>
                    (Optional)
                  </span>
                )}
              </div>

              {/* Voice-to-text Mic Button */}
              <button
                type="button"
                onClick={toggleListening}
                className="btn btn-ghost btn-icon"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: isListening ? 'hsl(var(--danger) / 0.1)' : 'transparent',
                  color: isListening ? 'hsl(var(--danger))' : 'hsl(var(--muted-foreground))',
                  border: isListening ? '1px solid hsl(var(--danger) / 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                <Mic size={18} style={isListening ? { animation: 'pulse-icon 1.5s infinite' } : {}} />
              </button>

              {/* Save Note Button */}
              <button
                type="button"
                onClick={handleAddNote}
                disabled={isSubmitting || !currentNote.trim()}
                className="btn btn-primary"
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isSubmitting || !currentNote.trim()) ? 0.6 : 1,
                  cursor: (isSubmitting || !currentNote.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{isSubmitting ? 'Saving...' : 'Save Note'}</span>
                <Send size={16} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', textAlign: 'right', paddingRight: '8px' }}>
            Shortcut: <kbd style={{ background: 'hsl(var(--card-border))', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>Ctrl</kbd> + <kbd style={{ background: 'hsl(var(--card-border))', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>Enter</kbd> to save
          </div>
        </div>
      </div>

      {/* Saved Notes Section */}
      <div className="glass-card" style={{ padding: '0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--card-border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Clock size={18} style={{ color: 'hsl(var(--primary))' }} />
            Recent Notes ({filteredNotes.length})
          </h3>

          {/* Action Item Status Filter Buttons & Refresh */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={fetchNotes}
              disabled={isLoading}
              className="btn btn-ghost"
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                backgroundColor: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--card-border))',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Refresh notes from database"
            >
              <RotateCcw size={12} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh Table'}</span>
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('All'); setCurrentPage(1); }}
              className="btn"
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: statusFilter === 'All' ? '#1f4854' : 'hsl(var(--card))',
                color: statusFilter === 'All' ? '#ffffff' : 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--card-border))'
              }}
            >
              All ({notes.length})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('Pending'); setCurrentPage(1); }}
              className="btn"
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: statusFilter === 'Pending' ? '#d97706' : 'hsl(var(--card))',
                color: statusFilter === 'Pending' ? '#ffffff' : 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--card-border))'
              }}
            >
              Pending ({pendingNotesCount})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('Completed'); setCurrentPage(1); }}
              className="btn"
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: statusFilter === 'Completed' ? '#1ba37c' : 'hsl(var(--card))',
                color: statusFilter === 'Completed' ? '#ffffff' : 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--card-border))'
              }}
            >
              Completed ({completedNotesCount})
            </button>
          </div>
        </div>
        
        <div style={{ padding: '24px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--muted-foreground))' }}>
              Loading recent notes...
            </div>
          ) : notes.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 24px', 
              backgroundColor: 'hsl(var(--background))',
              borderRadius: '12px',
              border: '2px dashed hsl(var(--card-border))',
              color: 'hsl(var(--muted-foreground))',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: 'hsl(var(--card-border))', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'hsl(var(--muted-foreground))'
              }}>
                <BookOpen size={32} />
              </div>
              <div>
                <p style={{ fontWeight: '600', fontSize: '16px', color: 'hsl(var(--foreground))', marginBottom: '4px' }}>No notes yet</p>
                <p style={{ fontSize: '14px' }}>Your saved administrative notes will appear here.</p>
              </div>
            </div>
          ) : (
            <>
            <div className="table-wrapper" style={{ overflow: 'visible', minHeight: '160px' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Created At</th>
                    <th style={{ width: '130px' }}>Reminder</th>
                    <th>Note Content</th>
                    <th style={{ width: '150px' }}>Action Item</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedNotes.map((note) => {
                    const isCompleted = Boolean(note.is_completed || note.action_item === 'Completed');
                    const status: AdminActionStatus = isCompleted ? 'Completed' : 'Pending';
                    const theme = ACTION_STATUS_THEME[status];
                    const isOpen = openDropdownId === note.id;

                    return (
                      <tr key={note.id} style={{ transition: 'background-color 0.2s ease' }}>
                        <td style={{ 
                          color: 'hsl(var(--muted-foreground))',
                          verticalAlign: 'top',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {new Date(note.timestamp).toLocaleString(undefined, { 
                            dateStyle: 'medium', 
                            timeStyle: 'short' 
                          })}
                        </td>
                        
                        {editingNoteId === note.id ? (
                          <>
                            <td style={{ verticalAlign: 'top' }}>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                  type="date"
                                  value={editReminderDate}
                                  min={new Date().toISOString().split('T')[0]}
                                  onChange={(e) => setEditReminderDate(e.target.value)}
                                  className="form-input reminder-date-input"
                                  style={{ padding: '6px', fontSize: '12px', width: '130px', paddingRight: editReminderDate ? '24px' : '6px' }}
                                  title="Follow-up Date (Optional)"
                                />
                                {editReminderDate && (
                                  <button
                                    type="button"
                                    onClick={() => setEditReminderDate('')}
                                    style={{
                                      position: 'absolute',
                                      right: '4px',
                                      background: 'none',
                                      border: 'none',
                                      color: 'hsl(var(--muted-foreground))',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    title="Clear date"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'top' }}>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="form-textarea"
                                style={{ minHeight: '80px', padding: '10px', fontSize: '13px', width: '100%' }}
                              />
                            </td>
                            <td style={{ verticalAlign: 'top', width: '150px' }}>
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as AdminActionStatus)}
                                className="form-select"
                                style={{ padding: '6px 8px', fontSize: '12px', width: '100%', borderRadius: '6px' }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </td>
                            <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button 
                                  type="button"
                                  onClick={handleSaveEdit} 
                                  className="btn btn-primary btn-icon" 
                                  style={{ width: '32px', height: '32px', minHeight: '32px' }} 
                                  title="Save Changes"
                                >
                                  <Check size={14} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={cancelEditing} 
                                  className="btn btn-secondary btn-icon" 
                                  style={{ width: '32px', height: '32px', minHeight: '32px' }} 
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ verticalAlign: 'top' }}>
                              {note.reminderDate ? (
                                <span style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '6px', 
                                  background: 'hsl(var(--primary) / 0.1)', 
                                  color: 'hsl(var(--primary))', 
                                  padding: '4px 10px', 
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '12px'
                                }}>
                                  <Calendar size={12} />
                                  {new Date(note.reminderDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                </span>
                              ) : (
                                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>-</span>
                              )}
                            </td>

                            {/* Note Content */}
                            <td style={{ 
                              whiteSpace: 'pre-wrap',
                              verticalAlign: 'top',
                              color: 'hsl(var(--foreground))',
                              lineHeight: '1.6'
                            }}>
                              {note.content}
                            </td>

                            {/* Action Item Status Column */}
                            <td style={{ verticalAlign: 'top', width: '150px' }}>
                              <div className="action-item-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(isOpen ? null : note.id);
                                  }}
                                  className="btn"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 12px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: `1px solid ${theme.border}`,
                                    backgroundColor: theme.bg,
                                    color: theme.color,
                                    transition: 'all 0.15s ease',
                                    outline: 'none',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {isCompleted ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                                  <span>{status}</span>
                                  <ChevronDown size={12} style={{ opacity: 0.7 }} />
                                </button>

                                {isOpen && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 'calc(100% + 4px)',
                                      left: 0,
                                      zIndex: 100,
                                      minWidth: '140px',
                                      padding: '6px',
                                      borderRadius: '10px',
                                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                      backgroundColor: 'hsl(var(--card))',
                                      border: '1px solid hsl(var(--card-border))',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange(note, 'Pending')}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        padding: '7px 10px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: !isCompleted ? ACTION_STATUS_THEME['Pending'].bg : 'transparent',
                                        color: !isCompleted ? ACTION_STATUS_THEME['Pending'].color : 'hsl(var(--foreground))',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background-color 0.15s ease'
                                      }}
                                    >
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={13} />
                                        Pending
                                      </span>
                                      {!isCompleted && <Check size={13} />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange(note, 'Completed')}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        padding: '7px 10px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: isCompleted ? ACTION_STATUS_THEME['Completed'].bg : 'transparent',
                                        color: isCompleted ? ACTION_STATUS_THEME['Completed'].color : 'hsl(var(--foreground))',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background-color 0.15s ease'
                                      }}
                                    >
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <CheckCircle2 size={13} />
                                        Completed
                                      </span>
                                      {isCompleted && <Check size={13} />}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button 
                                  type="button"
                                  onClick={() => startEditing(note)} 
                                  className="btn btn-ghost btn-icon" 
                                  style={{ width: '32px', height: '32px', minHeight: '32px', color: 'hsl(var(--primary))' }} 
                                  title="Edit Note"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteNote(note.id)} 
                                  className="btn btn-ghost btn-icon hover-danger" 
                                  style={{ width: '32px', height: '32px', minHeight: '32px' }} 
                                  title="Delete Note"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 4px 0', borderTop: '1px solid hsl(var(--card-border))', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label htmlFor="notes-rows-per-page" style={{ fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                  Rows per page
                </label>
                <select
                  id="notes-rows-per-page"
                  className="form-select"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ padding: '5px 28px 5px 10px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', minWidth: '65px' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-ghost btn-icon"
                    style={{ width: '30px', height: '30px', opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', border: '1px solid hsl(var(--card-border))', borderRadius: '6px', background: 'hsl(var(--background))' }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-ghost btn-icon"
                    style={{ width: '30px', height: '30px', opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', border: '1px solid hsl(var(--card-border))', borderRadius: '6px', background: 'hsl(var(--background))' }}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
      
      <style>{`
        .note-input-container:focus-within {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15), inset 0 2px 4px rgba(0,0,0,0.05) !important;
        }
        .admin-table tbody tr:hover {
          background-color: hsl(var(--primary) / 0.03);
        }
        .reminder-date-input:focus {
          border-color: hsl(var(--primary)) !important;
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15) !important;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
          transition: 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
        .hover-danger {
          color: hsl(var(--muted-foreground));
          transition: all 0.2s ease;
        }
        .hover-danger:hover {
          color: hsl(var(--danger)) !important;
          background-color: hsl(var(--danger) / 0.1) !important;
        }
        @keyframes pulse-icon {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Notes;
