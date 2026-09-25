import React, { useState, useEffect } from 'react';
import { ClipboardList, Calendar, Flag, User, Clock, CheckCircle, Search, FileText, Eye, X, CheckCheck, Trash2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  getLocalEmployeeTasks,
  updateLocalEmployeeTask,
  saveLocalEmployeeTask,
  deleteLocalEmployeeTask,
  getLocalEmployees,
  getLocalDailyReports,
  updateLocalDailyReport,
  type EmployeeTask,
  type Employee,
  type EmployeeDailyReport
} from '../lib/localDatabase';

interface TeamTasksProps {
  isDemo: boolean;
}

const TeamTasks: React.FC<TeamTasksProps> = ({ isDemo }) => {
  const [currentView, setCurrentView] = useState<'tasks' | 'reports'>('tasks');
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [reports, setReports] = useState<EmployeeDailyReport[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('All');
  const [selectedReport, setSelectedReport] = useState<EmployeeDailyReport | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    let fetchedTasks: EmployeeTask[] = [];
    let fetchedEmployees: Employee[] = [];
    let fetchedReports: EmployeeDailyReport[] = [];

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const [tasksRes, empRes, repRes] = await Promise.all([
          supabase.from('employee_tasks').select('*').order('created_at', { ascending: false }),
          supabase.from('employees').select('*'),
          supabase.from('employee_daily_reports').select('*').order('report_date', { ascending: false })
        ]);
        if (!tasksRes.error) fetchedTasks = tasksRes.data;
        if (!empRes.error) fetchedEmployees = empRes.data;
        if (!repRes.error && repRes.data) fetchedReports = repRes.data;
        else fetchedReports = getLocalDailyReports();
      } catch (err) {
        console.error('Error fetching data:', err);
        fetchedReports = getLocalDailyReports();
      }
    } else {
      fetchedTasks = getLocalEmployeeTasks();
      fetchedEmployees = getLocalEmployees();
      fetchedReports = getLocalDailyReports();
    }

    setTasks(fetchedTasks);
    setReports(fetchedReports);
    
    // Create employee lookup map
    const empMap: Record<string, Employee> = {};
    fetchedEmployees.forEach(emp => {
      empMap[emp.id] = emp;
    });
    setEmployees(empMap);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [isDemo]);



  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this assigned task?')) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    deleteLocalEmployeeTask(taskId);
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('employee_tasks').delete().eq('id', taskId);
      } catch (err) {
        console.error('Error deleting task from Supabase:', err);
      }
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: 'Pending' | 'In Progress' | 'Completed') => {
    // Optimistic update
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    if (!isDemo && isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('employee_tasks').update({ status: newStatus }).eq('id', taskId);
      if (error) {
        console.error('Error updating task:', error);
        alert('Failed to update task status in database.');
        fetchData(); // revert
      }
    } else {
      updateLocalEmployeeTask(taskId, { status: newStatus });
    }
  };

  const filteredTasks = tasks.filter(task => {
    const q = searchTerm.toLowerCase();
    const empName = employees[task.employee_id]?.name || '';
    return !q || task.title.toLowerCase().includes(q) || empName.toLowerCase().includes(q);
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'hsl(var(--danger))';
      case 'Medium': return 'hsl(var(--primary))';
      case 'Low': return 'hsl(var(--success))';
      default: return 'hsl(var(--muted))';
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'Completed') return false;
    return new Date(dueDate) < new Date(new Date().setHours(0,0,0,0));
  };

  const renderColumn = (title: string, status: string, icon: React.ReactNode, bgColor: string, dotColor: string) => {
    const columnTasks = filteredTasks.filter(t => t.status === status);
    
    return (
      <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bgColor, borderRadius: '12px', border: '1px solid hsl(var(--card-border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            <span style={{ display: 'flex', width: '24px', height: '24px', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', borderRadius: '6px', color: dotColor }}>
              {icon}
            </span>
            {title}
          </div>
          <div style={{ background: 'var(--card)', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, color: dotColor }}>
            {columnTasks.length}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {columnTasks.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--muted))', fontSize: '13px', border: '2px dashed hsl(var(--card-border))', borderRadius: '12px' }}>
              No tasks
            </div>
          ) : (
            columnTasks.map(task => {
              const overdue = isOverdue(task.due_date, task.status);
              
              return (
                <div key={task.id} className="glass-card" style={{ padding: '16px', borderLeft: `3px solid ${getPriorityColor(task.priority)}`, position: 'relative', overflow: 'hidden' }}>
                  {overdue && (
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '2px 8px', background: 'hsl(var(--danger))', color: 'white', fontSize: '10px', fontWeight: 800, borderBottomLeftRadius: '8px' }}>
                      OVERDUE
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '15px', color: 'hsl(var(--foreground))', margin: 0, paddingRight: overdue ? '40px' : '0', flex: 1 }}>
                      {task.title}
                    </h4>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      title="Delete assigned task"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'hsl(var(--muted))',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        flexShrink: 0,
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--danger))')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--muted))')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  {task.description && (
                    <p style={{ fontSize: '13px', color: 'hsl(var(--muted))', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'hsl(var(--muted))' }}>
                      <User size={13} />
                      <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        {employees[task.employee_id]?.name || 'Unknown Employee'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: overdue ? 'hsl(var(--danger))' : 'hsl(var(--muted))', fontWeight: overdue ? 600 : 400 }}>
                      <Calendar size={13} />
                      {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    {status !== 'Pending' && (
                      <button onClick={() => updateTaskStatus(task.id, 'Pending')} className="btn btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '28px' }}>
                        Set Pending
                      </button>
                    )}
                    {status !== 'In Progress' && (
                      <button onClick={() => updateTaskStatus(task.id, 'In Progress')} className="btn btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '28px', color: 'hsl(var(--primary))' }}>
                        Set In Progress
                      </button>
                    )}
                    {status !== 'Completed' && (
                      <button onClick={() => updateTaskStatus(task.id, 'Completed')} className="btn btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '28px', color: 'hsl(var(--success))', background: 'hsl(var(--success) / 0.1)', borderColor: 'transparent' }}>
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.4s ease-out' }}>
      
      {/* Header & Controls */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="brand-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentView === 'tasks' ? <ClipboardList size={24} /> : <FileText size={24} />}
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(var(--foreground))', marginBottom: '4px' }}>
              {currentView === 'tasks' ? 'Team Tasks' : 'Employee Daily Reports'}
            </h2>
            <p style={{ color: 'hsl(var(--muted))', fontSize: '0.95rem' }}>
              {currentView === 'tasks' ? 'Track and manage employee assignments & progress.' : 'Review daily work updates and submissions from team members.'}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'hsl(var(--background))',
            padding: '4px',
            borderRadius: '10px',
            border: '1.5px solid hsl(var(--card-border))',
            boxShadow: 'inset 0 1px 3px rgba(31, 72, 84, 0.06)',
            gap: '4px'
          }}>
            <button
              type="button"
              onClick={() => setCurrentView('tasks')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: currentView === 'tasks' ? 'hsl(var(--primary))' : 'transparent',
                color: currentView === 'tasks' ? '#ffffff' : 'hsl(var(--foreground))',
                boxShadow: currentView === 'tasks' ? '0 2px 6px rgba(31, 72, 84, 0.25)' : 'none',
                transition: 'all 0.18s ease'
              }}
            >
              <ClipboardList size={15} style={{ opacity: currentView === 'tasks' ? 1 : 0.85 }} />
              Tasks Board
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('reports')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: currentView === 'reports' ? 'hsl(var(--primary))' : 'transparent',
                color: currentView === 'reports' ? '#ffffff' : 'hsl(var(--foreground))',
                boxShadow: currentView === 'reports' ? '0 2px 6px rgba(31, 72, 84, 0.25)' : 'none',
                transition: 'all 0.18s ease'
              }}
            >
              <FileText size={15} style={{ opacity: currentView === 'reports' ? 1 : 0.85 }} />
              Daily Reports
              <span style={{
                marginLeft: '4px',
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 800,
                background: currentView === 'reports' ? 'rgba(255, 255, 255, 0.25)' : 'hsl(var(--primary) / 0.12)',
                color: currentView === 'reports' ? '#ffffff' : 'hsl(var(--primary))'
              }}>
                {reports.length}
              </span>
            </button>
          </div>

          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--primary))' }} />
            <input
              type="text"
              placeholder={currentView === 'tasks' ? "Search tasks or team..." : "Search reports..."}
              className="form-input"
              style={{ width: '100%', paddingLeft: '36px', borderRadius: '20px', fontSize: '13px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid hsl(var(--primary) / 0.3)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      ) : currentView === 'tasks' ? (
        /* Kanban Board */
        <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '16px' }}>
          {renderColumn('Pending', 'Pending', <Clock size={14} />, 'hsl(var(--card-border) / 0.3)', 'hsl(var(--muted))')}
          {renderColumn('In Progress', 'In Progress', <Flag size={14} />, 'hsl(var(--primary) / 0.05)', 'hsl(var(--primary))')}
          {renderColumn('Completed', 'Completed', <CheckCircle size={14} />, 'hsl(var(--success) / 0.05)', 'hsl(var(--success))')}
        </div>
      ) : (
        /* Daily Reports List / Table for Admin */
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>Employee Daily Report History</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: 'hsl(var(--foreground))', fontWeight: 700 }}>Filter by Employee:</label>
              <select
                className="form-input"
                style={{ width: '180px', padding: '6px 12px', fontSize: '13px' }}
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="All">All Employees</option>
                {Object.values(employees).map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              No daily reports found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid hsl(var(--card-border))', background: 'hsl(var(--background) / 0.6)', color: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '14px 16px', color: 'hsl(var(--foreground))' }}>Date</th>
                    <th style={{ padding: '14px 16px', color: 'hsl(var(--foreground))' }}>Employee</th>
                    <th style={{ padding: '14px 16px', color: 'hsl(var(--foreground))' }}>Today's Update Highlights</th>
                    <th style={{ padding: '14px 16px', color: 'hsl(var(--foreground))' }}>Hours</th>
                    <th style={{ padding: '14px 16px', color: 'hsl(var(--foreground))' }}>Status</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: 'hsl(var(--foreground))' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports
                    .filter(r => {
                      const matchesEmp = employeeFilter === 'All' || r.employee_name === employeeFilter;
                      const q = searchTerm.toLowerCase();
                      const matchesSearch = !q || r.employee_name.toLowerCase().includes(q) || r.today_updates.toLowerCase().includes(q);
                      return matchesEmp && matchesSearch;
                    })
                    .map(rep => (
                      <tr key={rep.id} style={{ borderBottom: '1px solid hsl(var(--card-border) / 0.6)', fontSize: '13.5px' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                          {new Date(rep.report_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                            <User size={14} style={{ color: 'hsl(var(--primary))' }} />
                            {rep.employee_name}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '420px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'hsl(var(--foreground))', fontWeight: 500, fontSize: '13.5px' }}>
                            {rep.today_updates}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: 'hsl(var(--primary))' }}>
                          {rep.hours_worked} hrs
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: rep.status === 'Reviewed' ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--warning) / 0.18)',
                            color: rep.status === 'Reviewed' ? 'hsl(var(--success))' : '#b45309'
                          }}>
                            {rep.status === 'Reviewed' ? 'Reviewed' : 'Submitted'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedReport(rep)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                          >
                            <Eye size={13} /> View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Report Review Modal */}
      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setSelectedReport(null)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--card-border))', boxShadow: '0 20px 40px rgba(0,0,0,0.35)', borderRadius: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(var(--primary))' }}>Daily Work Report</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'hsl(var(--foreground))', marginTop: '3px' }}>
                  {selectedReport.employee_name} — {new Date(selectedReport.report_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
              </div>
              <button onClick={() => setSelectedReport(null)} className="btn btn-ghost btn-icon" style={{ width: '32px', height: '32px', color: 'hsl(var(--foreground))' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'hsl(var(--primary))', marginBottom: '8px', letterSpacing: '0.04em' }}>1. TODAY'S WORK UPDATES:</div>
                <div style={{ padding: '16px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', borderRadius: '10px', fontSize: '14px', color: 'hsl(var(--foreground))', fontWeight: 500, whiteSpace: 'pre-wrap', lineHeight: '1.65' }}>
                  {selectedReport.today_updates}
                </div>
              </div>

              {selectedReport.challenges_blockers && (
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#dc2626', marginBottom: '8px', letterSpacing: '0.04em' }}>2. CHALLENGES / BLOCKERS:</div>
                  <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', fontSize: '14px', color: 'hsl(var(--foreground))', fontWeight: 500, whiteSpace: 'pre-wrap', lineHeight: '1.65' }}>
                    {selectedReport.challenges_blockers}
                  </div>
                </div>
              )}

              {selectedReport.plan_for_tomorrow && (
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'hsl(var(--primary))', marginBottom: '8px', letterSpacing: '0.04em' }}>3. PLAN FOR TOMORROW:</div>
                  <div style={{ padding: '16px', background: 'rgba(31, 72, 84, 0.08)', border: '1px solid rgba(31, 72, 84, 0.22)', borderRadius: '10px', fontSize: '14px', color: 'hsl(var(--foreground))', fontWeight: 500, whiteSpace: 'pre-wrap', lineHeight: '1.65' }}>
                    {selectedReport.plan_for_tomorrow}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '14px 18px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', borderRadius: '10px', fontSize: '13.5px', color: 'hsl(var(--foreground))' }}>
                <div><strong style={{ color: 'hsl(var(--foreground))' }}>Hours Logged:</strong> <span style={{ fontWeight: 800, color: 'hsl(var(--primary))' }}>{selectedReport.hours_worked} hrs</span></div>
                <div><strong style={{ color: 'hsl(var(--foreground))' }}>Status:</strong> <span style={{ fontWeight: 800, color: selectedReport.status === 'Reviewed' ? 'hsl(var(--success))' : '#b45309' }}>{selectedReport.status}</span></div>
                <div><strong style={{ color: 'hsl(var(--foreground))' }}>Submitted At:</strong> <span style={{ fontWeight: 600 }}>{new Date(selectedReport.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                {selectedReport.status !== 'Reviewed' && (
                  <button
                    onClick={() => {
                      updateLocalDailyReport(selectedReport.id, { status: 'Reviewed' });
                      setSelectedReport({ ...selectedReport, status: 'Reviewed' });
                      fetchData();
                    }}
                    className="btn btn-primary"
                    style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  >
                    <CheckCheck size={16} /> Mark as Reviewed
                  </button>
                )}
                <button onClick={() => setSelectedReport(null)} className="btn btn-secondary" style={{ padding: '8px 18px', fontWeight: 600 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Auto-Dismiss Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 9999,
          animation: 'fade-in 0.25s ease-out'
        }}>
          <CheckCircle size={18} />
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TeamTasks;
