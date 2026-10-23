import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Send,
  Mic,
  Trash2,
  RotateCcw,
  Edit,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Mail,
  Handshake,
  Filter,
  FileSpreadsheet,
  ChevronDown,
  Download
} from 'lucide-react';
import { getNoteDateString, formatFilterDateLabel, noteMatchesDate } from './Dashboard';
import {
  getLocalNotes,
  syncLocalSalesNotes,
  saveLocalNote,
  updateLocalNote,
  deleteLocalNote,
  resolveNoteStage,
  resolveNoteCategories,
  NOTE_STAGES,
  SALES_FLOW_STAGES,
  type Note,
  type NoteStage,
  type UserSession,
  type SalesWorkstreamCategory,
  WORKSTREAM_CATEGORIES
} from '../lib/localDatabase';
import { supabase } from '../lib/supabaseClient';

export const SALES_STAGE_THEME: Record<string, { bg: string; color: string; border: string }> = {
  // 8 Pipeline Stages
  'Cold Email Outreach': { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: 'rgba(2, 132, 199, 0.35)' },
  'Lead Research': { bg: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: 'rgba(99, 102, 241, 0.35)' },
  'Initial Call': { bg: 'rgba(217, 119, 6, 0.15)', color: '#d97706', border: 'rgba(217, 119, 6, 0.35)' },
  'Requirement Identification': { bg: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed', border: 'rgba(124, 58, 237, 0.35)' },
  'Requirement-Based Email Sent': { bg: 'rgba(15, 118, 110, 0.15)', color: '#0f766e', border: 'rgba(15, 118, 110, 0.35)' },
  'Partnership Proposal': { bg: 'rgba(225, 29, 72, 0.12)', color: '#e11d48', border: 'rgba(225, 29, 72, 0.35)' },
  'Partnership Conversation': { bg: 'rgba(5, 150, 105, 0.15)', color: '#059669', border: 'rgba(5, 150, 105, 0.35)' },
  'Partnership Followup': { bg: 'rgba(147, 51, 234, 0.12)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.35)' },

  // Backward compatibility for legacy stages
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
  searchQuery = ''
}) => {
  const [notes, setNotes] = useState<Note[]>(() => getLocalNotes('sales'));

  // Quick note form state
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [quickNoteStage, setQuickNoteStage] = useState<NoteStage | ''>('');
  const [quickNoteCategory, setQuickNoteCategory] = useState<SalesWorkstreamCategory | ''>('');
  const [quickNoteReminder, setQuickNoteReminder] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Table filtering, pagination and search state
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'exact' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('all');
  const [exactDate, setExactDate] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showDateRangeInputs, setShowDateRangeInputs] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>(searchQuery);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);

  // Edit and Delete modals state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const handleOpenEditModal = (note: Note) => {
    const categories = resolveNoteCategories(note);
    const resolvedCategory = (note.category && note.category !== 'null' && note.category !== 'None') 
      ? (note.category as SalesWorkstreamCategory) 
      : (categories[0] || undefined);
    const resolvedStage = resolveNoteStage(note) || (note.stage && note.stage !== 'null' && note.stage !== 'None' ? (note.stage as NoteStage) : undefined);
    
    setEditingNote({
      ...note,
      category: resolvedCategory,
      stage: resolvedStage
    });
  };

  // Speech to text state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const container = document.getElementById('sales-notes-filter-dropdown-container');
      if (container && !container.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

  useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

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

  // Fetch sales notes directly from Supabase DB
  const fetchSalesNotes = async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('role', 'sales')
          .order('timestamp', { ascending: false });
        if (!error && data) {
          const strictlySales = (data as Note[]).filter(
            n => n.role === 'sales' && n.created_by !== 'Admin' && !String(n.id).startsWith('sales-note-today-')
          );
          if (strictlySales.length > 0) {
            syncLocalSalesNotes(strictlySales);
            setNotes(getLocalNotes('sales'));
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching sales notes from DB:', err);
      }
    }
    const local = getLocalNotes('sales').filter(
      n => n.role === 'sales' && n.created_by !== 'Admin' && !String(n.id).startsWith('sales-note-today-')
    );
    setNotes(local);
  };

  useEffect(() => {
    fetchSalesNotes();
    const handleSalesNotesUpdated = () => fetchSalesNotes();
    window.addEventListener('sales-notes-updated', handleSalesNotesUpdated);
    window.addEventListener('storage', handleSalesNotesUpdated);
    window.addEventListener('focus', handleSalesNotesUpdated);
    return () => {
      window.removeEventListener('sales-notes-updated', handleSalesNotesUpdated);
      window.removeEventListener('storage', handleSalesNotesUpdated);
      window.removeEventListener('focus', handleSalesNotesUpdated);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchSalesNotes();
      showToast('Sales notes refreshed from database!', 'success');
    } catch {
      showToast('Failed to refresh sales notes', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleDeleteSalesNote = async (id: string) => {
    if (supabase) {
      try {
        await supabase.from('notes').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting note from DB:', err);
      }
    }
    deleteLocalNote(id, 'sales');
    await fetchSalesNotes();
    if (editingNote && String(editingNote.id) === String(id)) {
      setEditingNote(null);
    }
    setNoteToDelete(null);
    showToast('Sales note deleted from database successfully.', 'info');
    if (onUpdate) onUpdate();
  };

  const handleSaveEditSalesNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    const hasStage = Boolean(editingNote.stage && editingNote.stage !== 'null' && editingNote.stage !== 'None' && String(editingNote.stage).trim() !== '');
    const finalStage = hasStage ? (editingNote.stage as NoteStage) : undefined;
    const catCandidate = editingNote.category || resolveNoteCategories(editingNote)[0];
    const hasCategory = Boolean(catCandidate && catCandidate !== 'null' && catCandidate !== 'None' && String(catCandidate).trim() !== '');
    const finalCategory = hasCategory ? (catCandidate as SalesWorkstreamCategory) : undefined;
    const finalActionItem = finalCategory ? `Workstream: ${finalCategory}` : (finalStage || null);

    const isCompleted = Boolean(finalStage === 'Customer Onboarding' || finalStage === 'Converted' || finalStage === 'Partnership Followup' || editingNote.is_completed);

    if (supabase) {
      try {
        const { error: updateError } = await supabase.from('notes').update({
          content: editingNote.content.trim(),
          stage: finalStage || null,
          action_item: finalActionItem,
          reminderDate: editingNote.reminderDate || null,
          is_completed: isCompleted
        }).eq('id', editingNote.id);
        if (updateError) {
          console.error('Error updating sales note in Supabase:', updateError);
        }
      } catch (err) {
        console.error('Error updating sales note in DB:', err);
      }
    }

    updateLocalNote(editingNote.id, {
      content: editingNote.content.trim(),
      stage: finalStage,
      action_item: finalActionItem || undefined,
      category: finalCategory,
      reminderDate: editingNote.reminderDate || undefined,
      is_completed: isCompleted
    }, 'sales');

    await fetchSalesNotes();
    setEditingNote(null);
    showToast('Sales note updated successfully!', 'success');
    if (onUpdate) onUpdate();
  };

  // Add new sales note directly to Supabase DB
  const handleAddSalesNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !quickNoteContent.trim()) return;

    setIsSaving(true);
    try {
      const noteId = 'sales-note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      const nowIso = new Date().toISOString();
      const hasStage = Boolean(quickNoteStage && String(quickNoteStage) !== 'null' && String(quickNoteStage) !== 'None');
      const finalStage = hasStage ? (quickNoteStage as NoteStage) : undefined;
      const hasCategory = Boolean(quickNoteCategory && String(quickNoteCategory) !== 'null' && String(quickNoteCategory) !== 'None');
      const finalCategory = hasCategory ? (quickNoteCategory as SalesWorkstreamCategory) : undefined;
      const finalActionItem = finalCategory ? `Workstream: ${finalCategory}` : (finalStage || undefined);

      const newNoteData = {
        id: noteId,
        content: quickNoteContent.trim(),
        stage: finalStage,
        action_item: finalActionItem,
        category: finalCategory,
        reminderDate: quickNoteReminder || null,
        is_completed: finalStage === 'Customer Onboarding' || finalStage === 'Converted' || finalStage === 'Partnership Followup',
        role: 'sales',
        created_by: currentUser?.name || 'Sales Desk',
        timestamp: nowIso
      };

      if (supabase) {
        try {
          await supabase.from('notes').insert([{
            id: newNoteData.id,
            content: newNoteData.content,
            role: 'sales',
            stage: finalStage || null,
            action_item: finalActionItem || null,
            is_completed: newNoteData.is_completed,
            created_by: newNoteData.created_by,
            reminderDate: newNoteData.reminderDate || null,
            timestamp: newNoteData.timestamp
          }]);
        } catch (dbErr) {
          console.error('Supabase direct insert error:', dbErr);
        }
      }

      saveLocalNote(newNoteData as any, 'sales');

      await fetchSalesNotes();
      setQuickNoteContent('');
      setQuickNoteReminder('');
      setQuickNoteStage('');
      setQuickNoteCategory('');
      showToast('Sales note saved successfully!', 'success');
      if (onUpdate) onUpdate();
    } finally {
      setIsSaving(false);
    }
  };

  // Unique dates present in sales desk ledger for dynamic date-wise filter pills
  const uniqueSalesDates = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return;
      const dStr = getNoteDateString(n);
      if (dStr) {
        map.set(dStr, (map.get(dStr) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({ date, count }));
  }, [notes]);

  // Export Sales Notes to formatted Excel (.xls) spreadsheet
  const handleExportSalesNotesToExcel = (notesToExport: Note[], customFilterName?: string) => {
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
      dateFilter === 'exact' ? `${formatFilterDateLabel(exactDate)} Updates` :
      dateFilter === 'today' ? "Today's Updates" :
      dateFilter === 'yesterday' ? "Yesterday's Updates" :
      dateFilter === 'last7' ? "Last 7 Days Updates" :
      dateFilter === 'custom' ? `Custom Range (${customStartDate || 'start'} to ${customEndDate || 'today'})` :
      stageFilter !== 'all' ? `${stageFilter} Stage` :
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

  // Filter by picked date from calendar and export immediately
  const handleFilterAndExportByDate = (dateVal: string) => {
    if (!dateVal) return;
    setExactDate(dateVal);
    setDateFilter('exact');
    setCurrentPage(1);
    setShowFilterDropdown(false);

    const matching = notes.filter(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return false;
      return noteMatchesDate(n, dateVal);
    });

    if (matching.length > 0) {
      handleExportSalesNotesToExcel(matching, `${formatFilterDateLabel(dateVal)} Updates`);
    } else {
      showToast(`No sales updates recorded for ${formatFilterDateLabel(dateVal)}. Filter applied.`, 'info');
    }
  };

  const handleClearDateFilter = () => {
    setDateFilter('all');
    setExactDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setShowDateRangeInputs(false);
    setShowFilterDropdown(false);
    setCurrentPage(1);
    showToast('Date filter cleared. Showing all notes.', 'info');
  };

  // Notes strictly matching the active date filter for stage counts and pipeline distribution
  const activeDateScopedNotes = useMemo(() => {
    return notes.filter(n => {
      if (n.role === 'admin' || n.created_by === 'Admin') return false;
      const dStr = getNoteDateString(n);

      if (dateFilter === 'exact') {
        if (exactDate && !noteMatchesDate(n, exactDate)) return false;
      } else if (dateFilter === 'today') {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (dStr !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yesterdayStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
        if (dStr !== yesterdayStr) return false;
      } else if (dateFilter === 'last7') {
        const past = new Date();
        past.setDate(past.getDate() - 7);
        const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
        const todayStr = new Date().toISOString().split('T')[0];
        if (!dStr || dStr < pastStr || dStr > todayStr) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate || customEndDate) {
          if (!dStr || (customStartDate && dStr < customStartDate) || (customEndDate && dStr > customEndDate)) return false;
        }
      }
      return true;
    });
  }, [notes, dateFilter, exactDate, customStartDate, customEndDate]);

  // Filtered and paginated sales notes for table
  const filteredNotes = activeDateScopedNotes
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter(n => {
      const stage = resolveNoteStage(n);
      if (stageFilter !== 'all' && stage !== stageFilter) return false;
      const q = localSearch.trim().toLowerCase();
      if (q && !n.content.toLowerCase().includes(q) && !(n.created_by || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

  const totalPages = Math.ceil(filteredNotes.length / rowsPerPage) || 1;
  const startIdx = (currentPage - 1) * rowsPerPage;
  const paginatedNotes = filteredNotes.slice(startIdx, startIdx + rowsPerPage);

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
                  Workstream
                </label>
                <select
                  value={quickNoteCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickNoteCategory(val ? (val as SalesWorkstreamCategory) : '');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbe0e8',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    color: '#162e3b',
                    minWidth: '150px'
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#5b7b88' }}>
                  Pipeline Stage
                </label>
                <select
                  value={quickNoteStage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickNoteStage(val ? (val as NoteStage) : '');
                  }}
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
                  <option value="">-- None (null) --</option>
                  {NOTE_STAGES.map(stg => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#5b7b88' }}>
                    Follow-up Date (Optional)
                  </label>
                  {quickNoteReminder && (
                    <button
                      type="button"
                      onClick={() => setQuickNoteReminder('')}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '10.5px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={quickNoteReminder}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setQuickNoteReminder(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      paddingLeft: '34px',
                      paddingRight: quickNoteReminder ? '28px' : '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbe0e8',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#162e3b'
                    }}
                    title="Follow-up Date (Optional - leave blank if not scheduled)"
                  />
                  <Calendar size={14} style={{ position: 'absolute', left: '12px', color: '#7a9aa7', pointerEvents: 'none' }} />
                  {quickNoteReminder && (
                    <button
                      type="button"
                      onClick={() => setQuickNoteReminder('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
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
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: '18px' }}>
              <button
                type="submit"
                disabled={isSaving || !quickNoteContent.trim()}
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
                  cursor: (isSaving || !quickNoteContent.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isSaving || !quickNoteContent.trim()) ? 0.6 : 1
                }}
              >
                <Send size={15} />
                <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Main Full Sales Notes Ledger (Matching Reference Image) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(71, 121, 135, 0.15)', color: '#477987', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#162e3b', margin: 0 }}>
                  Sales Notes Ledger
                </h3>
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
                  {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#5b7b88', margin: '2px 0 0 0' }}>
                Complete pipeline flow records, client discussions, and overdue follow-up alerts.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search notes / client..."
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '7px 14px',
                  paddingLeft: '32px',
                  borderRadius: '8px',
                  border: '1px solid #cbe0e8',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#162e3b',
                  minWidth: '200px'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#7a9aa7', pointerEvents: 'none' }} />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => { setLocalSearch(''); setCurrentPage(1); }}
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#7a9aa7', cursor: 'pointer', fontSize: '12px' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Button with Calendar Dropdown */}
            <div style={{ position: 'relative' }} id="sales-notes-filter-dropdown-container">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: dateFilter !== 'all' ? '#0f766e' : '#107c41',
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
                <Filter size={14} />
                <span>Filter</span>
                {dateFilter === 'exact' && exactDate && (
                  <span style={{ fontSize: '10.5px', backgroundColor: '#ccfbf1', color: '#0f766e', padding: '1px 7px', borderRadius: '999px', fontWeight: 800 }}>
                    {formatFilterDateLabel(exactDate)}
                  </span>
                )}
                <ChevronDown size={13} style={{ opacity: 0.85, transform: showFilterDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
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
                    {dateFilter !== 'all' && (
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
                      value={dateFilter === 'exact' ? exactDate : ''}
                      onChange={e => {
                        if (e.target.value) {
                          handleFilterAndExportByDate(e.target.value);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.currentTarget.value || exactDate)) {
                          handleFilterAndExportByDate(e.currentTarget.value || exactDate);
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
                      const targetDate = exactDate || new Date().toISOString().split('T')[0];
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
                    <span>Export {exactDate ? formatFilterDateLabel(exactDate) : 'Selected Date'} Notes (.xls)</span>
                  </button>

                  {dateFilter !== 'all' && (
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

            {/* Refresh Table Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#477987',
                fontSize: '12.5px',
                fontWeight: 700,
                border: '1px solid #cbe0e8',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
              title="Refresh table from database"
            >
              <RotateCcw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Table'}</span>
            </button>
          </div>
        </div>

        {/* Active Filter Indicators Bar */}
        {(dateFilter !== 'all' || stageFilter !== 'all' || localSearch) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbe0e8',
              padding: '8px 12px',
              marginBottom: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#5b7b88' }}>
                Active Filters ({filteredNotes.length} matching):
              </span>

              {dateFilter !== 'all' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#ccfbf1',
                    color: '#0f766e',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Calendar size={11} />
                  <span>
                    {dateFilter === 'exact' ? `Date: ${formatFilterDateLabel(exactDate)}` :
                     dateFilter === 'today' ? 'Today' :
                     dateFilter === 'yesterday' ? 'Yesterday' :
                     dateFilter === 'last7' ? 'Last 7 Days' :
                     `Custom (${customStartDate || 'start'} to ${customEndDate || 'today'})`}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearDateFilter}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </span>
              )}

              {stageFilter !== 'all' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#e6f3f7',
                    color: '#477987',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Stage: {stageFilter}</span>
                  <button
                    type="button"
                    onClick={() => { setStageFilter('all'); setCurrentPage(1); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                handleClearDateFilter();
                setStageFilter('all');
                setLocalSearch('');
                setCurrentPage(1);
              }}
              style={{
                fontSize: '11.5px',
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Reset All Filters
            </button>
          </div>
        )}

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
            onClick={() => { setStageFilter('all'); setCurrentPage(1); }}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              border: stageFilter === 'all' ? '1px solid #477987' : '1px solid hsl(var(--card-border))',
              backgroundColor: stageFilter === 'all' ? '#477987' : 'hsl(var(--card))',
              color: stageFilter === 'all' ? '#ffffff' : 'hsl(var(--foreground))',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            All Stages ({activeDateScopedNotes.length})
          </button>

          {SALES_FLOW_STAGES.map((stg, idx) => {
            const count = activeDateScopedNotes.filter(n => resolveNoteStage(n) === stg).length;
            const theme = SALES_STAGE_THEME[stg] || SALES_STAGE_THEME['Target Customer'];
            const isActive = stageFilter === stg;

            return (
              <button
                key={stg}
                type="button"
                onClick={() => { setStageFilter(isActive ? 'all' : stg); setCurrentPage(1); }}
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

        {/* Notes Table */}
        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 24px', color: 'hsl(var(--muted))', fontSize: '13px', backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px dashed hsl(var(--card-border))' }}>
            No sales notes found under stage "{stageFilter}".{' '}
            <button
              onClick={() => { setStageFilter('all'); setCurrentPage(1); }}
              style={{ background: 'none', border: 'none', color: '#477987', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              View all stages
            </button>
          </div>
        ) : (
          <div>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>CREATED DATE</th>
                    <th style={{ width: '180px' }}>PIPELINE STAGE</th>
                    <th style={{ width: '160px' }}>WORK STREAM</th>
                    <th>NOTE CONTENT / CLIENT DISCUSSION</th>
                    <th style={{ width: '130px' }}>NEXT ALERT</th>
                    <th style={{ width: '130px' }}>LOGGED BY</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedNotes.map(note => {
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
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <span>{wsConfig.icon}</span>
                              <span>{workstream}</span>
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>—</span>
                          )}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '13.5px', color: 'hsl(var(--foreground))', fontWeight: 500, lineHeight: 1.45, maxWidth: '520px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                              onClick={() => handleOpenEditModal(note)}
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

            {/* Pagination Matching Reference Image */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid hsl(var(--card-border))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label htmlFor="select-sales-notes-rows-page" style={{ fontSize: '13px', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                  Rows per page
                </label>
                <select
                  id="select-sales-notes-rows-page"
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
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
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
      </div>

      {/* Edit Note Modal */}
      {editingNote && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#162e3b', margin: 0 }}>
                Edit Sales Note
              </h3>
              <button
                onClick={() => setEditingNote(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSalesNote} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Note Content / Client Discussion
                </label>
                <textarea
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Workstream
                  </label>
                  <select
                    value={editingNote.category || resolveNoteCategories(editingNote)[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingNote({
                        ...editingNote,
                        category: val ? (val as SalesWorkstreamCategory) : undefined
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">-- None (null) --</option>
                    {WORKSTREAM_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Pipeline Stage
                  </label>
                  <select
                    value={editingNote.stage || resolveNoteStage(editingNote) || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingNote({
                        ...editingNote,
                        stage: val ? (val as NoteStage) : undefined
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">-- None (null) --</option>
                    {NOTE_STAGES.map(stg => (
                      <option key={stg} value={stg}>{stg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                      Follow-up Date (Optional)
                    </label>
                    {editingNote.reminderDate && (
                      <button
                        type="button"
                        onClick={() => setEditingNote({ ...editingNote, reminderDate: undefined })}
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={editingNote.reminderDate || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, reminderDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                    title="Follow-up Date (Optional - leave blank if not scheduled)"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="btn btn-ghost"
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#477987',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', margin: '0 0 8px 0' }}>
              Delete Sales Note
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this sales note? This action cannot be undone.
            </p>
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#334155',
              marginBottom: '20px',
              maxHeight: '80px',
              overflowY: 'auto'
            }}>
              "{noteToDelete.content}"
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="btn btn-ghost"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSalesNote(noteToDelete.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesNotes;
