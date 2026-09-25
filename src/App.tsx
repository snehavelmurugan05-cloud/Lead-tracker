import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import LeadModule from './pages/LeadModule';
import PendingTasks from './pages/PendingTasks';
import Conversion from './pages/Conversion';
import Courses from './pages/Courses';
import ManageCourses from './pages/ManageCourses';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import Notes from './pages/Notes';
import PendingNotes from './pages/PendingNotes';
import Employees from './pages/Employees';
import TeamTasks from './pages/TeamTasks';
import StudentModule from './pages/StudentModule';
import EmployeeTasks from './pages/EmployeeTasks';
import EmployeeDailyReportModule from './pages/EmployeeDailyReport';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import {
  getLocalEnquiries,
  getLocalNotes,
  getLocalEmployeeTasks,
  getCurrentUserSession,
  setCurrentUserSession,
  type UserSession
} from './lib/localDatabase';

export const App: React.FC = () => {
  // Current user session (Admin or Employee)
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const session = getCurrentUserSession();
    if (session) return session;
    // Backward compatibility: if previously authenticated as admin
    if (localStorage.getItem('isAuthenticated') === 'true') {
      const defaultAdmin: UserSession = {
        id: 'admin-1',
        name: 'Administrator',
        username: 'admin',
        role: 'admin',
        role_title: 'System Admin'
      };
      setCurrentUserSession(defaultAdmin);
      return defaultAdmin;
    }
    return null;
  });

  const isAuthenticated = Boolean(currentUser);

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    if (currentUser?.role === 'employee') {
      return hash === 'daily-reports' ? 'daily-reports' : 'employee-tasks';
    }
    return hash || 'dashboard';
  });

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingNotesCount, setPendingNotesCount] = useState<number>(0);
  const [employeePendingCount, setEmployeePendingCount] = useState<number>(0);
  const [leadPrefillName, setLeadPrefillName] = useState<string>('');
  const [reportPrefill, setReportPrefill] = useState<string>('');

  // Decide default mode: if Supabase config is missing, fall back to offline simulation
  const [isDemo, setIsDemo] = useState<boolean>(!isSupabaseConfigured());

  // Theme control: read from localStorage or default to light
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync activeTab with URL hash on load and hash change with strict role-based route guard
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');

      if (!currentUser) return;

      if (currentUser.role === 'employee') {
        const validEmployeeTabs = ['employee-tasks', 'daily-reports'];
        if (validEmployeeTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          // Strictly prevent employee from accessing admin routes
          setActiveTab('employee-tasks');
          window.location.hash = 'employee-tasks';
        }
      } else {
        // Admin user
        const validAdminTabs = [
          'dashboard',
          'leads',
          'pending-tasks',
          'pending-notes',
          'conversion',
          'courses',
          'manage-courses',
          'student-module',
          'notes',
          'employees',
          'team-tasks',
          'settings'
        ];
        if (validAdminTabs.includes(hash)) {
          setActiveTab(hash);
        } else if (hash === 'employee-tasks' || hash === 'daily-reports') {
          setActiveTab('team-tasks');
          window.location.hash = 'team-tasks';
        } else {
          setActiveTab('dashboard');
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  // Update hash when activeTab changes
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Fetch count of pending tasks across application or employee tasks
  const updatePendingCount = async () => {
    if (currentUser?.role === 'employee') {
      const empTasks = getLocalEmployeeTasks();
      const count = empTasks.filter(t =>
        (t.employee_id === currentUser.id ||
         t.employee_id.toLowerCase().includes(currentUser.username.toLowerCase()) ||
         t.employee_id === `emp-${currentUser.username.toLowerCase()}`) &&
        t.status !== 'Completed'
      ).length;
      setEmployeePendingCount(count);
      return;
    }

    // Admin pending count
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: enqs } = await supabase.from('enquiries').select('interested, follow_up_done, can_follow_up');
        if (enqs) {
          const count = enqs.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null).length;
          setPendingCount(count);
        }

        const { data: nts, error: notesError } = await supabase.from('notes').select('reminderDate, is_completed');
        if (!notesError && nts) {
          const nCount = nts.filter(n => n.reminderDate && !n.is_completed).length;
          setPendingNotesCount(nCount);
        } else {
          const localNts = getLocalNotes();
          const nCount = localNts.filter(n => n.reminderDate && !n.is_completed).length;
          setPendingNotesCount(nCount);
        }
      } catch (err) {
        console.error('Error fetching pending counts:', err);
      }
    } else {
      const enqs = getLocalEnquiries();
      const count = enqs.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null).length;
      setPendingCount(count);

      const nts = getLocalNotes();
      const nCount = nts.filter(n => n.reminderDate && !n.is_completed).length;
      setPendingNotesCount(nCount);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      updatePendingCount();
    }
  }, [isDemo, refreshTrigger, isAuthenticated, currentUser]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleDatabaseUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoginSuccess = (session?: UserSession) => {
    if (session) {
      setCurrentUser(session);
      setCurrentUserSession(session);
      localStorage.setItem('isAuthenticated', 'true');
      if (session.role === 'employee') {
        setActiveTab('employee-tasks');
        window.location.hash = 'employee-tasks';
      } else {
        setActiveTab('dashboard');
        window.location.hash = 'dashboard';
      }
    } else {
      // Default admin fallback
      const adminSession: UserSession = {
        id: 'admin-1',
        name: 'Administrator',
        username: 'admin',
        role: 'admin',
        role_title: 'System Admin'
      };
      setCurrentUser(adminSession);
      setCurrentUserSession(adminSession);
      localStorage.setItem('isAuthenticated', 'true');
      setActiveTab('dashboard');
      window.location.hash = 'dashboard';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setCurrentUserSession(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
    window.location.hash = '';
  };

  const handleNavigateToLead = (prefill?: string) => {
    if (prefill && prefill.trim()) {
      setLeadPrefillName(prefill.trim());
    } else {
      setLeadPrefillName('');
    }
    setActiveTab('leads');
  };

  // Keep Demo mode synced with env key availability
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsDemo(true);
    }
  }, [refreshTrigger]);

  // IF NOT AUTHENTICATED: Show ONLY the Login screen
  if (!isAuthenticated || !currentUser) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  // Render employee view tabs (Strictly segregated from Admin)
  if (currentUser.role === 'employee') {
    return (
      <div className="app-container">
        {/* Background design elements */}
        <div className="bg-gradient-mesh" />

        {/* Sidebar Navigation for Employee */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isDemo={isDemo}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogout={handleLogout}
          currentUser={currentUser}
          employeePendingCount={employeePendingCount}
        />

        {/* Main Employee Viewport */}
        <main className="main-content">
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingCount={employeePendingCount}
            theme={theme}
            toggleTheme={toggleTheme}
            currentUser={currentUser}
          />

          <div style={{ marginTop: '8px' }}>
            {activeTab === 'daily-reports' ? (
              <EmployeeDailyReportModule
                currentUser={currentUser}
                isDemo={isDemo}
                initialPrefill={reportPrefill}
                onClearPrefill={() => setReportPrefill('')}
              />
            ) : (
              <EmployeeTasks
                currentUser={currentUser}
                isDemo={isDemo}
                onNavigateToReport={(taskTitle) => {
                  if (taskTitle) {
                    setReportPrefill(`- Worked on task: ${taskTitle}\n`);
                  }
                  setActiveTab('daily-reports');
                }}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  // Render Admin portal tabs
  const renderAdminTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
            onNavigateToLead={handleNavigateToLead}
          />
        );
      case 'leads':
        return (
          <LeadModule
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            onNavigateToPendingTasks={() => setActiveTab('pending-tasks')}
            initialContactName={leadPrefillName}
            onClearPrefill={() => setLeadPrefillName('')}
          />
        );
      case 'pending-tasks':
        return (
          <PendingTasks
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
          />
        );
      case 'pending-notes':
        return (
          <PendingNotes
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
          />
        );
      case 'conversion':
        return (
          <Conversion
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            onNavigateToLead={() => setActiveTab('leads')}
          />
        );
      case 'courses':
        return (
          <Courses
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onNavigateToLead={handleNavigateToLead}
          />
        );
      case 'manage-courses':
        return (
          <ManageCourses
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
          />
        );
      case 'student-module':
        return (
          <StudentModule
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
            onNavigateToLead={handleNavigateToLead}
          />
        );
      case 'notes':
        return <Notes />;
      case 'employees':
        return <Employees isDemo={isDemo} />;
      case 'team-tasks':
        return <TeamTasks isDemo={isDemo} />;
      case 'settings':
        return (
          <SettingsPage
            isDemo={isDemo}
            setIsDemo={setIsDemo}
            onDatabaseUpdate={handleDatabaseUpdate}
          />
        );
      default:
        return (
          <Dashboard
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* Background design elements */}
      <div className="bg-gradient-mesh" />

      {/* Sidebar Navigation for Admin */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDemo={isDemo}
        theme={theme}
        toggleTheme={toggleTheme}
        pendingCount={pendingCount}
        pendingNotesCount={pendingNotesCount}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Main Administrative Portal Viewport */}
      <main className="main-content">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
          theme={theme}
          toggleTheme={toggleTheme}
          currentUser={currentUser}
        />

        {/* Banner indicating simulation state */}
        {isDemo && activeTab !== 'settings' && (
          <div className="demo-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--warning))', animation: 'pulse-red 1.5s infinite' }} />
              <span>
                <strong>Sandbox Offline Mode Active:</strong> You are exploring using local browser memory. Configure keys on the Settings page to link live Supabase functions.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
            >
              Configure Keys
            </button>
          </div>
        )}

        <div style={{ marginTop: '8px' }}>
          {renderAdminTab()}
        </div>
      </main>
    </div>
  );
};

export default App;
