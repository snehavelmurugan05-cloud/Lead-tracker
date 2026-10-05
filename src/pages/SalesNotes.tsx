import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Calendar,
  Send,
  Mic
} from 'lucide-react';
import {
  getLocalNotes,
  saveLocalNote,
  resolveNoteStage,
  NOTE_STAGES,
  type Note,
  type NoteStage,
  type UserSession
} from '../lib/localDatabase';

export const SALES_STAGE_THEME: Record<string, { bg: string; color: string; border: string }> = {
  'Target Customer': { bg: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: 'rgba(99, 102, 241, 0.35)' },
  'Lead Generation': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.35)' },
  'Demo': { bg: 'rgba(147, 51, 234, 0.12)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.35)' },
  'Requirement Gathering': { bg: 'rgba(217, 119, 6, 0.15)', color: '#d97706', border: 'rgba(217, 119, 6, 0.35)' },
  'Estimation': { bg: 'rgba(71, 121, 135, 0.15)', color: '#477987', border: 'rgba(71, 121, 135, 0.35)' },
  'Proposal': { bg: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.35)' },
  'Customer Onboarding': { bg: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c', border: 'rgba(27, 163, 124, 0.35)' },
  'Reached Out': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.35)' },
  'Pipeline': { bg: 'rgba(71, 121, 135, 0.15)', color: '#477987', border: 'rgba(71, 121, 135, 0.35)' },
  'Converted': { bg: 'rgba(27, 163, 124, 0.15)', color: '#1ba37c', border: 'rgba(27, 163, 124, 0.35)' },
  'To Be Follow Up': { bg: 'rgba(217, 119, 6, 0.15)', color: '#d97706', border: 'rgba(217, 119, 6, 0.35)' },
  'Delivery Due': { bg: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.35)' }
};

export const formatRelativeDue = (dateStr?: string) => {
  if (!dateStr) return { text: 'No alert date', color: '#5b7b88', bg: '#f1f5f9', border: '#cbe0e8', isOverdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { text: `Overdue ${days}d`, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.35)', isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'Due Today', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.15)', border: 'rgba(234, 88, 12, 0.35)', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Due Tomorrow', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', border: 'rgba(2, 132, 199, 0.3)', isOverdue: false };
  } else {
    return { text: `Due in ${diffDays}d`, color: '#477987', bg: 'rgba(71, 121, 135, 0.12)', border: 'rgba(71, 121, 135, 0.3)', isOverdue: false };
  }
};

interface SalesNotesProps {
  currentUser?: UserSession | null;
  onUpdate?: () => void;
  searchQuery?: string;
}

export const SalesNotes: React.FC<SalesNotesProps> = ({
  currentUser,
  onUpdate,
  searchQuery
}) => {
  const [notes, setNotes] = useState<Note[]>(() => getLocalNotes('sales'));

  // Quick note form state
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [quickNoteStage, setQuickNoteStage] = useState<NoteStage>('Reached Out');
  const [quickNoteReminder, setQuickNoteReminder] = useState('');

  // Speech to text state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Voice-to-text recognition setup
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
          setQuickNoteContent(prev => {
            const space = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + space + finalTranscript.trim();
          });
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition not supported in this browser.', 'error');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  // Fetch sales notes
  const fetchSalesNotes = () => {
    const data = getLocalNotes('sales');
    setNotes(data);
  };

  useEffect(() => {
    fetchSalesNotes();
    const handleSalesNotesUpdated = () => fetchSalesNotes();
    window.addEventListener('sales-notes-updated', handleSalesNotesUpdated);
    window.addEventListener('storage', handleSalesNotesUpdated);
    return () => {
      window.removeEventListener('sales-notes-updated', handleSalesNotesUpdated);
      window.removeEventListener('storage', handleSalesNotesUpdated);
    };
  }, []);



  // Add new sales note
  const handleAddSalesNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteContent.trim()) return;

    const newNoteData = {
      content: quickNoteContent.trim(),
      stage: quickNoteStage,
      action_item: quickNoteStage,
      reminderDate: quickNoteReminder || undefined,
      is_completed: quickNoteStage === 'Converted',
      role: 'sales',
      created_by: currentUser?.name || 'Sales Desk'
    };

    saveLocalNote(newNoteData, 'sales');
    fetchSalesNotes();
    setQuickNoteContent('');
    setQuickNoteReminder('');
    setQuickNoteStage('Reached Out');
    showToast('Sales note saved successfully!', 'success');
    if (onUpdate) onUpdate();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.3s ease-out' }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: toastMessage.type === 'error' ? 'rgba(220, 38, 38, 0.12)' : toastMessage.type === 'success' ? 'rgba(27, 163, 124, 0.15)' : 'rgba(71, 121, 135, 0.15)',
            border: `1px solid ${toastMessage.type === 'error' ? '#dc2626' : toastMessage.type === 'success' ? '#1ba37c' : '#477987'}`,
            color: toastMessage.type === 'error' ? '#dc2626' : toastMessage.type === 'success' ? '#1ba37c' : '#1f4854',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* Hero Card: Quick Sales Note Entry Form */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(71, 121, 135, 0.15)', color: '#477987', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
              Quick Sales Note Entry
            </h2>
            <p style={{ fontSize: '13px', color: '#5b7b88', margin: '2px 0 0 0' }}>
              Capture client conversation details immediately. The note appears instantly in the ledger below.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddSalesNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              id="sales-quick-note-textarea"
              placeholder="Type sales conversation details... (e.g. Spoke with client regarding counseling guidelines, scheduled follow-up call)"
              value={quickNoteContent}
              onChange={(e) => setQuickNoteContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '110px',
                padding: '14px',
                paddingRight: '50px',
                borderRadius: '10px',
                border: '1px solid #cbe0e8',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleAddSalesNote(e);
                }
              }}
            />

            {/* Voice input mic button */}
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Stop listening' : 'Dictate note with microphone'}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: isListening ? 'rgba(220, 38, 38, 0.12)' : 'none',
                color: isListening ? '#dc2626' : '#7a9aa7',
                border: isListening ? '1px solid rgba(220, 38, 38, 0.3)' : 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Mic size={17} style={isListening ? { animation: 'pulse-icon 1.5s infinite' } : {}} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#5b7b88' }}>
                  Pipeline Stage
                </label>
                <select
                  value={quickNoteStage}
                  onChange={(e) => setQuickNoteStage(e.target.value as NoteStage)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbe0e8',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    color: '#162e3b',
                    minWidth: '160px'
                  }}
                >
                  {NOTE_STAGES.map(stg => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#5b7b88' }}>
                  Follow-up Reminder Date
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={quickNoteReminder}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setQuickNoteReminder(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      paddingLeft: '34px',
                      borderRadius: '8px',
                      border: '1px solid #cbe0e8',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#162e3b'
                    }}
                    title="Optional reminder alert date"
                  />
                  <Calendar size={14} style={{ position: 'absolute', left: '12px', color: '#7a9aa7', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: '18px' }}>
              <button
                type="submit"
                disabled={!quickNoteContent.trim()}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#1f4854',
                  color: '#ffffff',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: 'none',
                  cursor: quickNoteContent.trim() ? 'pointer' : 'not-allowed',
                  opacity: quickNoteContent.trim() ? 1 : 0.6
                }}
              >
                <Send size={15} />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Recently Saved Notes - compact preview of last 3 */}
      {notes.length > 0 && (
        <div className="glass-card" style={{ padding: '20px 24px' }} id="sales-notes-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <BookOpen size={18} style={{ color: '#477987' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
              Recently Saved ({notes.length} total)
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...notes]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 3)
              .map((n) => {
                const stage = resolveNoteStage(n);
                const theme = SALES_STAGE_THEME[stage] || SALES_STAGE_THEME['Reached Out'];
                const dueInfo = formatRelativeDue(n.reminderDate);
                return (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #eef4f7'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: theme.bg,
                          color: theme.color,
                          border: `1px solid ${theme.border}`
                        }}
                      >
                        {stage}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {n.reminderDate && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: dueInfo.color,
                            backgroundColor: dueInfo.bg,
                            border: `1px solid ${dueInfo.border}`,
                            borderRadius: '10px',
                            padding: '2px 8px'
                          }}>
                            {dueInfo.text}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#7a9aa7' }}>
                          {new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          {' · '}
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#162e3b',
                      lineHeight: 1.5,
                      fontWeight: 500,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {n.content}
                    </p>
                  </div>
                );
              })
            }
            {notes.length > 3 && (
              <p style={{ margin: 0, fontSize: '12px', color: '#7a9aa7', textAlign: 'center', paddingTop: '4px' }}>
                +{notes.length - 3} more notes saved
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesNotes;
