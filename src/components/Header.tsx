import React, { useState, useEffect } from 'react';
import { Calendar, Bell, Search, Sun, Moon } from 'lucide-react';
import { type UserSession } from '../lib/localDatabase';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser?: UserSession | null;
  pendingCount?: number;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  pendingCount = 0,
  theme = 'light',
  toggleTheme,
  onSearch
}) => {
  const [time, setTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTitleDetails = () => {
    switch (activeTab) {
      case 'employee-tasks':
        return {
          title: 'My Tasks',
          subtitle: `Assigned tasks and daily responsibilities for ${currentUser?.name || 'Employee'}.`
        };
      case 'daily-reports':
        return {
          title: 'Daily Work Report',
          subtitle: 'Submit today\'s progress update and review long-term reporting archive.'
        };
      case 'dashboard':
        return {
          title: 'Admin Hub',
          subtitle: 'Every open lead, its reminder status, and the full tracking ledger.'
        };
      case 'leads':
        return {
          title: 'Lead Management',
          subtitle: 'Register new student and client enquiries with live course selection and follow-ups.'
        };
      case 'pending-tasks':
        return {
          title: 'Activity Center',
          subtitle: 'View and manage all lead follow-ups organized by alert due date.'
        };
      case 'pending-notes':
        return {
          title: 'Pending Notes',
          subtitle: 'Track unresolved follow-up reminders and scheduled note alerts.'
        };
      case 'conversion':
        return {
          title: 'Conversion Hub',
          subtitle: 'Track converted admissions, monitor conversion ratios, and track tuition revenue.'
        };
      case 'courses':
        return {
          title: 'Course Library',
          subtitle: 'Browse all available offering categories, courses, and fees.'
        };
      case 'manage-courses':
        return {
          title: 'Course Management',
          subtitle: 'Create and modify categories, courses, descriptions, and pricing structure.'
        };
      case 'student-module':
        return {
          title: 'Student',
          subtitle: 'View created courses and enrolled student details.'
        };
      case 'settings':
        return {
          title: 'System Settings',
          subtitle: 'Configure your Supabase backend and Gemini API keys.'
        };
      default:
        return {
          title: 'Admin Hub',
          subtitle: 'Every open lead, its reminder status, and the full tracking ledger.'
        };
    }
  };

  const { title, subtitle } = getTitleDetails();

  // Format: "Sat, Sep 19 12:33:06 PM"
  const formattedDateString = `${time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  return (
    <header className="main-header">
      <div className="header-title-section">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="header-actions">
        {/* Real-time Date & Time Pill (Matching Reference UI) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbe0e8',
            borderRadius: '9999px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#345967',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
          }}
        >
          <Calendar size={14} style={{ color: '#5b7b88' }} />
          <span>{formattedDateString}</span>
        </div>

        {/* Search Leads Input Pill (Matching Reference UI) */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search leads"
            value={searchQuery}
            onChange={handleSearchChange}
            style={{
              padding: '7px 36px 7px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbe0e8',
              borderRadius: '9999px',
              fontSize: '12.5px',
              color: '#162e3b',
              outline: 'none',
              width: '190px',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
            }}
          />
          <Search
            size={14}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#7a9aa7',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* Theme Toggle Pill (Matching Reference UI) */}
        {toggleTheme && (
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbe0e8',
              borderRadius: '9999px',
              cursor: 'pointer',
              color: '#345967',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            <Sun size={14} style={{ color: theme === 'light' ? '#ea580c' : '#7a9aa7' }} />
            <Moon size={14} style={{ color: theme === 'dark' ? '#1f4854' : '#7a9aa7' }} />
          </button>
        )}

        {/* Notification Bell with Badge (Matching Reference UI) */}
        <button
          onClick={() => setActiveTab('pending-tasks')}
          title="View Pending Tasks & Alert Days"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            position: 'relative',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#345967',
            transition: 'all 0.2s ease',
            padding: 0
          }}
        >
          <Bell size={20} />
          {pendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '1px',
                right: '1px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 800,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.4)'
              }}
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
