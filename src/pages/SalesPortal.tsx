import React, { useState } from 'react';
import { LayoutDashboard, StickyNote, Layers, Zap, BookOpen, Clock, ShieldCheck } from 'lucide-react';
import Dashboard from './Dashboard';
import Notes from './Notes';

interface SalesPortalProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateToLead?: (prefillName?: string) => void;
  onNavigateToNotes?: () => void;
  onNavigateToDashboard?: () => void;
}

export const SalesPortal: React.FC<SalesPortalProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate,
  onNavigateToLead,
  onNavigateToNotes,
  onNavigateToDashboard
}) => {
  // 'both' (Unified View) | 'dashboard' | 'notes'
  const [activeView, setActiveView] = useState<'both' | 'dashboard' | 'notes'>('both');

  return (
    <div className="sales-portal-wrapper">
      {/* Top Hero & View Selector Bar */}
      <div className="glass-card sales-portal-hero">
        <div className="sales-hero-left">
          <div className="sales-hero-badge">
            <ShieldCheck size={14} />
            <span>Sales &amp; Counseling Portal</span>
          </div>
          <h1 className="sales-hero-title">Live Dashboard &amp; Recent Notes</h1>
          <p className="sales-hero-desc">
            Monitor real-time enquiry performance, conversion metrics, and capture client meeting notes.
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="sales-view-controls">
          <button
            type="button"
            onClick={() => setActiveView('both')}
            className={`sales-pill-btn ${activeView === 'both' ? 'active' : ''}`}
            title="View Dashboard and Recent Notes combined on one page"
          >
            <Layers size={16} />
            <span>Unified View</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToDashboard && activeView === 'both') {
                setActiveView('dashboard');
              } else {
                setActiveView('dashboard');
              }
            }}
            className={`sales-pill-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            title="Focus on Dashboard only"
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToNotes && activeView === 'both') {
                setActiveView('notes');
              } else {
                setActiveView('notes');
              }
            }}
            className={`sales-pill-btn ${activeView === 'notes' ? 'active' : ''}`}
            title="Focus on Meeting & Recent Notes only"
          >
            <StickyNote size={16} />
            <span>Recent Notes</span>
          </button>
        </div>
      </div>

      {/* Main Content Area Based on Active View */}
      {activeView === 'both' ? (
        <div className="sales-unified-stack">
          {/* Section 1: Dashboard */}
          <div className="sales-section-block">
            <div className="sales-section-header-bar">
              <div className="sales-section-title-wrap">
                <div className="sales-icon-box">
                  <Zap size={18} />
                </div>
                <div>
                  <h2 className="sales-section-heading">Sales Performance Dashboard</h2>
                  <p className="sales-section-subheading">Track lead statuses, follow-up alerts, and conversion funnel</p>
                </div>
              </div>
            </div>
            
            <div className="sales-component-container">
              <Dashboard
                isDemo={isDemo}
                refreshTrigger={refreshTrigger}
                onUpdate={onUpdate}
                onNavigateToLead={onNavigateToLead}
              />
            </div>
          </div>

          {/* Section 2: Meeting & Recent Notes (Matches attached reference image) */}
          <div className="sales-section-block" style={{ marginTop: '36px' }}>
            <div className="sales-section-header-bar">
              <div className="sales-section-title-wrap">
                <div className="sales-icon-box notes-accent">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 className="sales-section-heading">Client Meeting &amp; Reminder Notes</h2>
                  <p className="sales-section-subheading">Capture key discussion points and review recent client notes</p>
                </div>
              </div>
            </div>

            <div className="sales-component-container">
              <Notes />
            </div>
          </div>
        </div>
      ) : activeView === 'dashboard' ? (
        <div className="sales-standalone-view">
          <Dashboard
            isDemo={isDemo}
            refreshTrigger={refreshTrigger}
            onUpdate={onUpdate}
            onNavigateToLead={onNavigateToLead}
          />
        </div>
      ) : (
        <div className="sales-standalone-view">
          <Notes />
        </div>
      )}

      <style>{`
        .sales-portal-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 40px;
        }

        .sales-portal-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          padding: 22px 28px;
          background: linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.8) 100%);
          border: 1px solid hsl(var(--card-border));
          border-radius: 16px;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
        }

        .sales-hero-left {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sales-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          background: hsl(var(--primary) / 0.12);
          color: hsl(var(--primary));
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          width: fit-content;
        }

        .sales-hero-title {
          font-size: 1.65rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: hsl(var(--foreground));
          margin: 0;
        }

        .sales-hero-desc {
          font-size: 13.5px;
          color: hsl(var(--muted-foreground));
          margin: 0;
        }

        .sales-view-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--card-border));
          border-radius: 12px;
        }

        .sales-pill-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: hsl(var(--muted-foreground));
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .sales-pill-btn:hover {
          color: hsl(var(--foreground));
          background: hsl(var(--card));
        }

        .sales-pill-btn.active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground, 0 0% 100%));
          box-shadow: 0 2px 8px hsl(var(--primary) / 0.35);
        }

        .sales-unified-stack {
          display: flex;
          flex-direction: column;
        }

        .sales-section-block {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sales-section-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: hsl(var(--card) / 0.6);
          border: 1px solid hsl(var(--card-border));
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        .sales-section-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sales-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: hsl(var(--primary) / 0.15);
          color: hsl(var(--primary));
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .sales-icon-box.notes-accent {
          background: hsl(142 70% 45% / 0.15);
          color: hsl(142 70% 45%);
        }

        .sales-section-heading {
          font-size: 1.15rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0;
        }

        .sales-section-subheading {
          font-size: 12.5px;
          color: hsl(var(--muted-foreground));
          margin: 0;
        }

        .sales-component-container {
          width: 100%;
        }

        .sales-standalone-view {
          animation: fadeIn 0.25s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .sales-portal-hero {
            flex-direction: column;
            align-items: flex-start;
          }
          .sales-view-controls {
            width: 100%;
            justify-content: space-between;
          }
          .sales-pill-btn {
            flex: 1;
            justify-content: center;
            padding: 8px 6px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default SalesPortal;
