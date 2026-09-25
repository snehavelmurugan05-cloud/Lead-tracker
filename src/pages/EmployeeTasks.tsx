import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  Flag,
  ArrowRight,
  FileText,
  User,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import {
  getLocalEmployeeTasks,
  updateLocalEmployeeTask,
  type EmployeeTask,
  type UserSession
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface EmployeeTasksProps {
  currentUser: UserSession;
  isDemo?: boolean;
  onNavigateToReport?: (prefillTaskTitle?: string) => void;
}

export const EmployeeTasks: React.FC<EmployeeTasksProps> = ({
  currentUser,
  isDemo = true,
  onNavigateToReport
}) => {
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  // Tasks are assigned strictly by Admin; Employee can update status and submit reports

  // Load ONLY tasks belonging to this logged in employee
  const fetchMyTasks = async () => {
    setIsLoading(true);
    let allTasks: EmployeeTask[] = [];

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('employee_tasks')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          allTasks = data as EmployeeTask[];
        } else {
          allTasks = getLocalEmployeeTasks();
        }
      } catch (err) {
        console.error('Supabase fetch failed, fallback to local:', err);
        allTasks = getLocalEmployeeTasks();
      }
    } else {
      allTasks = getLocalEmployeeTasks();
    }

    // STRICT ISOLATION FILTER:
    // Tasks must be created by Admin only; employee sees only their assigned tasks
    const myFiltered = allTasks.filter(t => {
      const empId = (currentUser.id || '').toLowerCase();
      const username = (currentUser.username || '').toLowerCase();
      const userEmail = (currentUser.email || '').toLowerCase();
      const userName = (currentUser.name || '').toLowerCase();

      const tEmpId = (t.employee_id || '').toLowerCase();
      return (
        tEmpId === empId ||
        tEmpId === username ||
        tEmpId === `emp-${username}` ||
        tEmpId.includes(username) ||
        (userEmail && tEmpId === userEmail) ||
        (userName && tEmpId.includes(userName))
      );
    });

    setTasks(myFiltered);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMyTasks();
  }, [currentUser.id, isDemo]);

  // Status Update Handler
  const handleStatusChange = async (taskId: string, newStatus: 'Pending' | 'In Progress' | 'Completed') => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('employee_tasks')
          .update({ status: newStatus })
          .eq('id', taskId);
      } catch (e) {
        console.error('Error updating task status on Supabase:', e);
      }
    }

    updateLocalEmployeeTask(taskId, { status: newStatus });
  };



  // KPI Calculations
  const totalCount = tasks.length;
  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  // Filter Tasks
  const displayedTasks = tasks.filter(task => {
    const matchesSearch =
      !searchTerm ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'Completed') return false;
    return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'High':
        return { bg: 'hsl(var(--danger) / 0.12)', border: 'hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))' };
      case 'Medium':
        return { bg: 'hsl(var(--warning) / 0.12)', border: 'hsl(var(--warning) / 0.3)', color: '#d97706' };
      case 'Low':
        return { bg: 'hsl(var(--success) / 0.12)', border: 'hsl(var(--success) / 0.3)', color: 'hsl(var(--success))' };
      default:
        return { bg: 'hsl(var(--muted) / 0.12)', border: 'hsl(var(--muted) / 0.3)', color: 'hsl(var(--muted))' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Welcome Banner */}
      <div 
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.08) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderLeft: '4px solid hsl(var(--primary))'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Employee Workspace
            </span>
            <span style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} />
              Assigned by Administration
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'hsl(var(--foreground))', margin: 0 }}>
            Welcome back, {currentUser.name}! 👋
          </h1>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Here are your official tasks assigned by Admin. Update your progress statuses and submit your daily report.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>

          {onNavigateToReport && (
            <button
              onClick={() => onNavigateToReport()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
            >
              <FileText size={16} />
              <span>Submit Daily Report</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        {/* Total Tasks */}
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase' }}>Total Tasks</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>{totalCount}</div>
          </div>
        </div>

        {/* Pending */}
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'hsl(var(--warning) / 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase' }}>Pending</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706' }}>{pendingCount}</div>
          </div>
        </div>

        {/* In Progress */}
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'hsl(210 90% 50% / 0.12)', color: 'hsl(210 90% 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase' }}>In Progress</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'hsl(210 90% 50%)' }}>{inProgressCount}</div>
          </div>
        </div>

        {/* Completed */}
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'hsl(var(--success) / 0.12)', color: 'hsl(var(--success))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'hsl(var(--success))' }}>{completedCount}</div>
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', background: 'hsl(var(--background))', padding: '4px', borderRadius: '8px', border: '1px solid hsl(var(--card-border))' }}>
            {(['All', 'Pending', 'In Progress', 'Completed'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: statusFilter === tab ? 'hsl(var(--primary))' : 'transparent',
                  color: statusFilter === tab ? '#ffffff' : 'hsl(var(--muted-foreground))',
                  fontSize: '12px',
                  fontWeight: statusFilter === tab ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search and Priority Filter */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px', padding: '7px 12px 7px 32px' }}
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="form-select"
              style={{ fontSize: '13px', padding: '6px 28px 6px 12px' }}
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

        </div>
      </div>

      {/* Task List Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--muted-foreground))' }}>
            Loading your tasks...
          </div>
        ) : displayedTasks.length === 0 ? (
          <div 
            className="glass-card" 
            style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '12px' 
            }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
              {statusFilter === 'All' ? 'No tasks assigned yet!' : `No ${statusFilter.toLowerCase()} tasks found.`}
            </h3>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', margin: 0, maxWidth: '400px' }}>
              {statusFilter === 'All'
                ? 'No tasks have been assigned to your queue by Admin yet. Once assigned, your work responsibilities will appear here.'
                : 'Try adjusting your search or priority filters to see other tasks.'}
            </p>
          </div>
        ) : (
          displayedTasks.map(task => {
            const pStyle = getPriorityStyle(task.priority);
            const overdue = isOverdue(task.due_date, task.status);

            return (
              <div
                key={task.id}
                className="glass-card"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '20px',
                  borderLeft: `4px solid ${
                    task.status === 'Completed'
                      ? 'hsl(var(--success))'
                      : task.status === 'In Progress'
                      ? 'hsl(210 90% 50%)'
                      : '#d97706'
                  }`,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    
                    {/* Priority Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: pStyle.bg,
                        border: `1px solid ${pStyle.border}`,
                        color: pStyle.color
                      }}
                    >
                      <Flag size={11} />
                      {task.priority} Priority
                    </span>

                    {/* Due Date Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: overdue ? 'hsl(var(--danger))' : 'hsl(var(--muted-foreground))'
                      }}
                    >
                      <Calendar size={13} />
                      Due: {new Date(task.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      {overdue && (
                        <span style={{ color: 'hsl(var(--danger))', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertTriangle size={12} />
                          (Overdue)
                        </span>
                      )}
                    </span>

                    {/* Assigned By */}
                    {task.assigned_by && (
                      <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} />
                        Assigned by: {task.assigned_by}
                      </span>
                    )}

                  </div>

                  {/* Task Title */}
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      margin: 0,
                      color: task.status === 'Completed' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                      textDecoration: task.status === 'Completed' ? 'line-through' : 'none'
                    }}
                  >
                    {task.title}
                  </h3>

                  {/* Task Description */}
                  {task.description && (
                    <p style={{ margin: 0, fontSize: '13px', color: 'hsl(var(--muted-foreground))', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {task.description}
                    </p>
                  )}

                </div>

                {/* Right Controls: Status Selector & Quick Report */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  
                  {/* Interactive Status Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                      Status:
                    </span>
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                      className="form-select"
                      style={{
                        padding: '6px 28px 6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor:
                          task.status === 'Completed'
                            ? 'hsl(var(--success) / 0.12)'
                            : task.status === 'In Progress'
                            ? 'hsl(210 90% 50% / 0.12)'
                            : 'hsl(var(--warning) / 0.12)',
                        color:
                          task.status === 'Completed'
                            ? 'hsl(var(--success))'
                            : task.status === 'In Progress'
                            ? 'hsl(210 90% 50%)'
                            : '#d97706',
                        borderColor:
                          task.status === 'Completed'
                            ? 'hsl(var(--success) / 0.3)'
                            : task.status === 'In Progress'
                            ? 'hsl(210 90% 50% / 0.3)'
                            : 'hsl(var(--warning) / 0.3)'
                      }}
                    >
                      <option value="Pending">⏱ Pending</option>
                      <option value="In Progress">⚡ In Progress</option>
                      <option value="Completed">✓ Completed</option>
                    </select>
                  </div>

                  {/* Add to Daily Report Action */}
                  {onNavigateToReport && (
                    <button
                      type="button"
                      onClick={() => onNavigateToReport(task.title)}
                      className="btn btn-ghost"
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        color: 'hsl(var(--primary))',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Add this task to Today's Daily Work Report"
                    >
                      <FileText size={12} />
                      <span>Add to Daily Report</span>
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

export default EmployeeTasks;
