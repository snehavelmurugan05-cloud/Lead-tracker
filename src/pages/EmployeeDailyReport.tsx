import React, { useState, useEffect } from 'react';
import {
  FileText,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Edit3,
  Award,
  BookOpen,
  ArrowRight,
  TrendingUp,
  History,
  X
} from 'lucide-react';
import {
  getLocalDailyReports,
  saveLocalDailyReport,
  getEmployeeDailyReports,
  type EmployeeDailyReport,
  type UserSession
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface EmployeeDailyReportProps {
  currentUser: UserSession;
  isDemo?: boolean;
  initialPrefill?: string;
  onClearPrefill?: () => void;
}

export const EmployeeDailyReportModule: React.FC<EmployeeDailyReportProps> = ({
  currentUser,
  isDemo = true,
  initialPrefill = '',
  onClearPrefill
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [reportDate, setReportDate] = useState(todayStr);
  const [todayUpdates, setTodayUpdates] = useState('');
  const [challenges, setChallenges] = useState('');
  const [planTomorrow, setPlanTomorrow] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8.0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // History State
  const [reports, setReports] = useState<EmployeeDailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<EmployeeDailyReport | null>(null);

  // Load employee reports
  const fetchReports = async () => {
    setIsLoading(true);
    let allReports: EmployeeDailyReport[] = [];

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('employee_daily_reports')
          .select('*')
          .order('report_date', { ascending: false });
        if (!error && data) {
          allReports = data as EmployeeDailyReport[];
        } else {
          allReports = getLocalDailyReports();
        }
      } catch (err) {
        console.error('Supabase fetch reports failed, using local:', err);
        allReports = getLocalDailyReports();
      }
    } else {
      allReports = getLocalDailyReports();
    }

    // Filter only for this employee
    const empId = currentUser.id || 'emp-sneha';
    const myReports = allReports
      .filter(r => r.employee_id === empId || r.employee_name.toLowerCase() === currentUser.name.toLowerCase())
      .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());

    setReports(myReports);

    // If today's report already exists, populate it in the form for editing/viewing
    const todayReport = myReports.find(r => r.report_date === todayStr);
    if (todayReport && !todayUpdates) {
      setTodayUpdates(todayReport.today_updates);
      setChallenges(todayReport.challenges_blockers || '');
      setPlanTomorrow(todayReport.plan_for_tomorrow || '');
      setHoursWorked(todayReport.hours_worked ? String(todayReport.hours_worked) : '8.0');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [currentUser.id, isDemo]);

  // Handle prefill from task module
  useEffect(() => {
    if (initialPrefill && initialPrefill.trim()) {
      setTodayUpdates(prev => {
        if (prev.includes(initialPrefill.trim())) return prev;
        const addition = `• Completed task: ${initialPrefill.trim()}`;
        return prev ? `${prev}\n${addition}` : addition;
      });
      if (onClearPrefill) onClearPrefill();
    }
  }, [initialPrefill]);

  // Handle Submit Form
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayUpdates.trim()) return;

    setIsSubmitting(true);
    setSubmitSuccess(false);

    const reportPayload: Omit<EmployeeDailyReport, 'id' | 'created_at'> = {
      employee_id: currentUser.id || 'emp-sneha',
      employee_name: currentUser.name,
      report_date: reportDate,
      today_updates: todayUpdates.trim(),
      challenges_blockers: challenges.trim() || undefined,
      plan_for_tomorrow: planTomorrow.trim() || undefined,
      hours_worked: hoursWorked ? parseFloat(hoursWorked) || hoursWorked : 8,
      status: 'Submitted'
    };

    // Save locally
    const saved = saveLocalDailyReport(reportPayload);

    // Sync with Supabase if configured
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('employee_daily_reports')
          .upsert([saved], { onConflict: 'employee_id,report_date' });
      } catch (err) {
        console.error('Error syncing report to Supabase:', err);
      }
    }

    // Refresh list
    await fetchReports();
    setIsSubmitting(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
  };

  // Filtered reports for history
  const filteredReports = reports.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.report_date.includes(q) ||
      r.today_updates.toLowerCase().includes(q) ||
      (r.plan_for_tomorrow && r.plan_for_tomorrow.toLowerCase().includes(q))
    );
  });

  const isTodaySubmitted = reports.some(r => r.report_date === todayStr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div 
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--success) / 0.08) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderLeft: '4px solid hsl(var(--success))'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--success))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Daily Work Reporting System
            </span>
            {isTodaySubmitted ? (
              <span style={{ background: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                ✓ Today's Report Submitted
              </span>
            ) : (
              <span style={{ background: 'hsl(var(--warning) / 0.15)', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                ⏱ Pending Today's Submission
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'hsl(var(--foreground))', margin: 0 }}>
            Daily Work Updates & Long-Term Report Archive
          </h1>
          <p style={{ color: 'hsl(var(--foreground) / 0.85)', fontSize: '14px', marginTop: '4px', margin: 0, fontWeight: 500 }}>
            Submit your daily work accomplishments, notes, and plan for tomorrow. All reports are permanently archived for long-term tracking.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'hsl(var(--foreground) / 0.8)', fontWeight: 700 }}>Total Reports Logged</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'hsl(var(--primary))' }}>{reports.length} Days</div>
          </div>
        </div>
      </div>

      {/* Grid: Form on Left, History Summary on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT: Daily Report Entry Form */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: 'hsl(var(--primary))' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
                Fill Today's Work Report
              </h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} style={{ color: 'hsl(var(--primary))' }} />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px' }}
              />
            </div>
          </div>

          {submitSuccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'hsl(var(--success) / 0.15)',
                border: '1px solid hsl(var(--success) / 0.35)',
                color: 'hsl(var(--success))',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={18} />
              <span>Report saved successfully! Your daily update has been logged into the permanent archive.</span>
            </div>
          )}

          <form onSubmit={handleSubmitReport} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Field 1: Today's Completed Work */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>
                1. Today's Work & Tasks Completed *
              </label>
              <textarea
                placeholder="• List tasks completed today, features built, client communications, or bug fixes..."
                value={todayUpdates}
                onChange={(e) => setTodayUpdates(e.target.value)}
                required
                className="form-textarea"
                rows={5}
                style={{ width: '100%', padding: '12px', fontSize: '13px', lineHeight: '1.6' }}
              />
            </div>

            {/* Field 2: Challenges / Blockers */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>
                2. Blockers / Challenges Faced (Optional)
              </label>
              <textarea
                placeholder="Any technical impediments, pending approvals, or dependencies needed..."
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                className="form-textarea"
                rows={2}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
              />
            </div>

            {/* Field 3: Plan for Tomorrow */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>
                3. Plan for Tomorrow / Next Working Day
              </label>
              <textarea
                placeholder="Key focus areas, planned code modules, or scheduled deliverables..."
                value={planTomorrow}
                onChange={(e) => setPlanTomorrow(e.target.value)}
                className="form-textarea"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
              />
            </div>

            {/* Hours Worked & Submit Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid hsl(var(--card-border))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} style={{ color: 'hsl(var(--primary))' }} />
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  Hours Worked:
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  className="form-input"
                  style={{ width: '70px', padding: '4px 8px', fontSize: '12px', textAlign: 'center', fontWeight: 700 }}
                />
                <span style={{ fontSize: '12px', color: 'hsl(var(--foreground))', fontWeight: 700 }}>hrs</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !todayUpdates.trim()}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px'
                }}
              >
                <Send size={16} />
                <span>{isSubmitting ? 'Submitting...' : isTodaySubmitted ? 'Update Today\'s Report' : 'Submit Daily Report'}</span>
              </button>
            </div>

          </form>
        </div>

        {/* RIGHT: Long-Term Archive & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: 'hsl(var(--primary))' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
                  Report Archive (Long Term)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'hsl(var(--foreground) / 0.85)', fontWeight: 700 }}>
                {filteredReports.length} records
              </span>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--primary))' }} />
              <input
                type="text"
                placeholder="Search report archive..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '12px', padding: '6px 10px 6px 32px' }}
              />
            </div>

            {/* List of Historical Reports */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                  Loading report archive...
                </div>
              ) : filteredReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                  No historical reports found.
                </div>
              ) : (
                filteredReports.map(report => {
                  const isToday = report.report_date === todayStr;

                  return (
                    <div
                      key={report.id}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: 'hsl(var(--background))',
                        border: `1px solid ${isToday ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--card-border))'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                            {new Date(report.report_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </span>
                          {isToday && (
                            <span style={{ fontSize: '10px', fontWeight: 800, background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', padding: '1px 6px', borderRadius: '4px' }}>
                              TODAY
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: report.status === 'Reviewed' ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--primary) / 0.12)',
                            color: report.status === 'Reviewed' ? 'hsl(var(--success))' : 'hsl(var(--primary))'
                          }}
                        >
                          {report.status}
                        </span>
                      </div>

                      {/* Snippet of updates */}
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: 'hsl(var(--foreground))',
                          fontWeight: 500,
                          lineHeight: '1.5',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {report.today_updates}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed hsl(var(--card-border))' }}>
                        <span style={{ fontSize: '11.5px', color: 'hsl(var(--foreground))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} style={{ color: 'hsl(var(--primary))' }} />
                          {report.hours_worked || 8} hrs logged
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedReport(report)}
                          className="btn btn-ghost"
                          style={{
                            padding: '4px 10px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: 'hsl(var(--primary))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Report Details Modal */}
      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '28px',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              border: '1px solid hsl(var(--card-border))'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                  Daily Work Report Details
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'hsl(var(--foreground))' }}>
                  {new Date(selectedReport.report_date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="btn btn-ghost btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              
              {/* Employee & Meta */}
              <div style={{ display: 'flex', gap: '12px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', padding: '12px 16px', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(var(--muted))' }}>SUBMITTED BY</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>{selectedReport.employee_name}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(var(--muted))' }}>HOURS LOGGED</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'hsl(var(--primary))' }}>{selectedReport.hours_worked || 8} Hours</div>
                </div>
              </div>

              {/* Tasks Completed */}
              <div>
                <h4 style={{ fontSize: '12.5px', fontWeight: 800, color: 'hsl(var(--primary))', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  1. TASKS COMPLETED &amp; UPDATES:
                </h4>
                <div style={{ fontSize: '14px', color: 'hsl(var(--foreground))', fontWeight: 500, lineHeight: '1.65', background: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', padding: '14px', borderRadius: '10px', whiteSpace: 'pre-wrap' }}>
                  {selectedReport.today_updates}
                </div>
              </div>

              {/* Challenges */}
              {selectedReport.challenges_blockers && (
                <div>
                  <h4 style={{ fontSize: '12.5px', fontWeight: 800, color: '#dc2626', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    2. BLOCKERS &amp; CHALLENGES:
                  </h4>
                  <div style={{ fontSize: '14px', color: 'hsl(var(--foreground))', fontWeight: 500, lineHeight: '1.65', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '14px', borderRadius: '10px', whiteSpace: 'pre-wrap' }}>
                    {selectedReport.challenges_blockers}
                  </div>
                </div>
              )}

              {/* Plan for Tomorrow */}
              {selectedReport.plan_for_tomorrow && (
                <div>
                  <h4 style={{ fontSize: '12.5px', fontWeight: 800, color: 'hsl(var(--primary))', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    3. PLAN FOR TOMORROW:
                  </h4>
                  <div style={{ fontSize: '14px', color: 'hsl(var(--foreground))', fontWeight: 500, lineHeight: '1.65', background: 'rgba(31, 72, 84, 0.08)', border: '1px solid rgba(31, 72, 84, 0.22)', padding: '14px', borderRadius: '10px', whiteSpace: 'pre-wrap' }}>
                    {selectedReport.plan_for_tomorrow}
                  </div>
                </div>
              )}

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid hsl(var(--card-border))' }}>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmployeeDailyReportModule;
