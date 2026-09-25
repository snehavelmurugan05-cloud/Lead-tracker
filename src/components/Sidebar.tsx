import React from 'react';
import {
  LayoutDashboard,
  Bell,
  BookOpen,
  FolderEdit,
  GraduationCap,
  CheckCircle2,
  StickyNote,
  Users,
  ClipboardList,
  FileText,
  Settings,
  Power
} from 'lucide-react';
import { type UserSession } from '../lib/localDatabase';
import globalMindsLogo from '../assets/global_minds_logo.jpg';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser?: UserSession | null;
  isDemo?: boolean;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
  pendingCount?: number;
  pendingNotesCount?: number;
  employeePendingCount?: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  pendingCount = 0,
  pendingNotesCount = 0,
  employeePendingCount = 0,
  onLogout
}) => {
  const isEmployee = currentUser?.role === 'employee';
  const totalPending = pendingCount + pendingNotesCount;

  // Role-Specific Navigation Menu Items
  const menuItems = isEmployee
    ? [
        { id: 'employee-tasks', label: 'My tasks', icon: ClipboardList, badge: employeePendingCount },
        { id: 'daily-reports', label: 'Daily report', icon: FileText }
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'pending-tasks', label: 'Pending', icon: Bell, badge: totalPending },
        { id: 'conversion', label: 'Conversion', icon: CheckCircle2 },
        { id: 'courses', label: 'Course management', icon: BookOpen },
        { id: 'manage-courses', label: 'Create course', icon: FolderEdit },
        { id: 'student-module', label: 'Student', icon: GraduationCap },
        { id: 'notes', label: 'Recent notes', icon: StickyNote },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'team-tasks', label: 'Team tasks', icon: ClipboardList },
        { id: 'settings', label: 'Settings', icon: Settings }
      ];

  const profileName = isEmployee ? currentUser.name : 'Admin';
  const profileRole = isEmployee ? (currentUser.role_title || 'Team Member · Global Minds') : 'Lead desk · Global Minds';
  const avatarLetter = profileName.charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      {/* Brand Logo Header */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)' }}>
          <img
            src={globalMindsLogo}
            alt="Global Minds"
            style={{ maxHeight: '36px', maxWidth: '160px', objectFit: 'contain', display: 'block' }}
          />
        </div>
      </div>

      {/* Top User Profile Block */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar">
          <span>{avatarLetter}</span>
        </div>
        <div className="sidebar-name">{profileName}</div>
        <div className="sidebar-role">{profileRole}</div>
      </div>

      {/* Navigation List */}
      <nav className="nav-links">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'pending-tasks' && (activeTab === 'pending-tasks' || activeTab === 'pending-notes'));

          return (
            <li key={item.id} className={`nav-item ${isActive ? 'active' : ''}`}>
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>

                {item.badge && item.badge > 0 ? (
                  <span className="nav-badge-danger">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </nav>

      {/* Footer / Sign Out Button (Matching Reference UI) */}
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={onLogout || (() => {
            localStorage.removeItem('isAuthenticated');
            window.location.reload();
          })}
          className="btn-sidebar-signout"
          title="Sign out of Admin Hub"
        >
          <Power size={17} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
