
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
import SalesNotes from './pages/SalesNotes';
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
import { checkAndNotifyDueReminders } from './lib/desktopNotification';

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
    if (currentUser?.role === 'sales') {
      return hash === 'notes' ? 'notes' : 'dashboard';
    }
    return hash || 'dashboard';
  });

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingNotesCount, setPendingNotesCount] = useState<number>(0);
  const [employeePendingCount, setEmployeePendingCount] = useState<number>(0);
  const [leadPrefillName, setLeadPrefillName] = useState<string>('');
  const [reportPrefill, setReportPrefill] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Mode: Default to live Supabase DB
  const [isDemo, setIsDemo] = useState<boolean>(false);

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
      } else if (currentUser.role === 'sales') {
        const validSalesTabs = ['dashboard', 'notes'];
        if (validSalesTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab('dashboard');
          window.location.hash = 'dashboard';
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

  // Fetch count of pending tasks directly from Supabase DB
  const updatePendingCount = async () => {
    if (currentUser?.role === 'employee') {
      if (supabase) {
        try {
          const { data } = await supabase.from('employee_tasks').select('*');
          if (data) {
            const count = data.filter(t =>
              (t.employee_id === currentUser.id ||
               (t.employee_id && t.employee_id.toLowerCase().includes((currentUser.username || '').toLowerCase())) ||
               t.employee_id === `emp-${(currentUser.username || '').toLowerCase()}`) &&
              t.status !== 'Completed'
            ).length;
            setEmployeePendingCount(count);
            return;
          }
        } catch (err) {
          console.error('Error fetching employee tasks from DB:', err);
        }
      }
      return;
    }

    const userRole = currentUser?.role === 'sales' ? 'sales' : 'admin';

    // Admin or Sales pending count from DB
    if (supabase) {
      try {
        const { data: enqs } = await supabase.from('enquiries').select('interested, follow_up_done, can_follow_up');
        if (enqs) {
          const count = enqs.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null).length;
          setPendingCount(count);
        }

        const { data: nts, error: notesError } = await supabase
          .from('notes')
          .select('reminderDate, is_completed, stage, action_item')
          .eq('role', userRole);

        if (!notesError && nts) {
          const todayDateStr = new Date().toISOString().split('T')[0];
          const isCompletedStage = (s: string | null) => s === 'Customer Onboarding' || s === 'Converted';

          if (userRole === 'sales') {
            const activeReminders = nts.filter(n => {
              if (n.is_completed) return false;
              if (isCompletedStage(n.stage)) return false;
              if (n.action_item === 'Converted') return false;
              if (!n.reminderDate) return false;
              return n.reminderDate <= todayDateStr;
            });
            setPendingNotesCount(activeReminders.length);
          } else {
            const nCount = nts.filter(n => n.reminderDate && !n.is_completed && !isCompletedStage(n.stage) && n.action_item !== 'Converted').length;
            setPendingNotesCount(nCount);
          }
        }
      } catch (err) {
        console.error('Error fetching pending counts from DB:', err);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      updatePendingCount();
      if (currentUser?.role !== 'employee') {
        checkAndNotifyDueReminders(currentUser?.role || 'admin');
      }

      const interval = setInterval(() => {
        if (currentUser?.role !== 'employee') {
          checkAndNotifyDueReminders(currentUser?.role || 'admin');
        }
      }, 10 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [isDemo, refreshTrigger, isAuthenticated, currentUser]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleDatabaseUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Realtime subscription for cross-device live data synchronization
  useEffect(() => {
    if (!supabase || isDemo) return;

    const channel = supabase.channel('cross-device-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        handleDatabaseUpdate();
        window.dispatchEvent(new CustomEvent('sales-notes-updated'));
        window.dispatchEvent(new CustomEvent('notes-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, () => {
        handleDatabaseUpdate();
        window.dispatchEvent(new CustomEvent('enquiries-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        handleDatabaseUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        handleDatabaseUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_tasks' }, () => {
        handleDatabaseUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_daily_reports' }, () => {
        handleDatabaseUpdate();
      })
      .subscribe();

    // Auto-refresh when window gains focus or becomes visible
    const handleFocus = () => {
      handleDatabaseUpdate();
      window.dispatchEvent(new CustomEvent('sales-notes-updated'));
      window.dispatchEvent(new CustomEvent('notes-updated'));
      window.dispatchEvent(new CustomEvent('enquiries-updated'));
    };

    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isDemo]);

  const handleLoginSuccess = (session?: UserSession) => {
    if (session) {
      setCurrentUser(session);
      setCurrentUserSession(session);
      localStorage.setItem('isAuthenticated', 'true');
      if (session.role === 'employee') {
        setActiveTab('employee-tasks');
        window.location.hash = 'employee-tasks';
      } else if (session.role === 'sales') {
        setActiveTab('dashboard');
        window.location.hash = 'dashboard';
      } else {
        setActiveTab('dashboard');
        window.location.hash = 'dashboard';
      }
      setRefreshTrigger(prev => prev + 1);
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
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setCurrentUserSession(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
    window.location.hash = '';
    setRefreshTrigger(prev => prev + 1);
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
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
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

  // Render Sales portal (Segregated for Sales role)
  if (currentUser.role === 'sales') {
    return (
      <div className="app-container">
        {/* Background design elements */}
        <div className="bg-gradient-mesh" />

        {/* Sidebar Navigation for Sales */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isDemo={isDemo}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogout={handleLogout}
          currentUser={currentUser}
          pendingCount={pendingCount}
          pendingNotesCount={pendingNotesCount}
        />

        {/* Main Sales Viewport */}
        <main className="main-content">
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingCount={pendingNotesCount}
            theme={theme}
            toggleTheme={toggleTheme}
            currentUser={currentUser}
            searchQuery={globalSearchQuery}
            onSearch={setGlobalSearchQuery}
            onNavigateToLead={handleNavigateToLead}
            refreshTrigger={refreshTrigger}
            onUpdate={handleDatabaseUpdate}
          />

          <div style={{ marginTop: '8px' }}>
            {activeTab === 'notes' ? (
              <SalesNotes
                currentUser={currentUser}
                onUpdate={handleDatabaseUpdate}
                searchQuery={globalSearchQuery}
              />
            ) : (
              <Dashboard
                isDemo={isDemo}
                refreshTrigger={refreshTrigger}
                onUpdate={handleDatabaseUpdate}
                onNavigateToLead={handleNavigateToLead}
                currentUser={currentUser}
                onNavigateTab={setActiveTab}
                searchQuery={globalSearchQuery}
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
            currentUser={currentUser}
            onNavigateTab={setActiveTab}
            searchQuery={globalSearchQuery}
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
        return (
          <SalesNotes
            currentUser={currentUser}
            onUpdate={handleDatabaseUpdate}
            searchQuery={globalSearchQuery}
          />
        );
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
            onNavigateToLead={handleNavigateToLead}
            currentUser={currentUser}
            onNavigateTab={setActiveTab}
            searchQuery={globalSearchQuery}
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
          pendingCount={pendingCount + pendingNotesCount}
          theme={theme}
          toggleTheme={toggleTheme}
          currentUser={currentUser}
          searchQuery={globalSearchQuery}
          onSearch={setGlobalSearchQuery}
          onNavigateToLead={handleNavigateToLead}
          refreshTrigger={refreshTrigger}
          onUpdate={handleDatabaseUpdate}
        />



        <div style={{ marginTop: '8px' }}>
          {renderAdminTab()}
        </div>
      </main>
    </div>
  );
};

export default App;
