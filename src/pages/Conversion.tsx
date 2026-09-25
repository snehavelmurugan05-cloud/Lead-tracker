import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  TrendingUp,
  Award,
  DollarSign,
  Search,
  UserCheck,
  User,
  Phone,
  BookOpen,
  Calendar,
  Filter,
  ArrowUpRight,
  Sparkles,
  Check,
  X,
  FileText,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Clock
} from 'lucide-react';
import {
  getLocalEnquiries,
  getLocalCourses,
  getLocalCategories,
  updateLocalEnquiry
} from '../lib/localDatabase';
import type { Enquiry, Course, Category } from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ConversionProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToLead?: () => void;
}

export const Conversion: React.FC<ConversionProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate,
  onNavigateToDashboard,
  onNavigateToLead
}) => {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all_completed' | 'interested' | 'not_interested'>('all_completed');

  // Convert Modal state
  const [convertingEnquiry, setConvertingEnquiry] = useState<Enquiry | null>(null);
  const [conversionNote, setConversionNote] = useState('');
  const [feePaidStatus, setFeePaidStatus] = useState('Full Payment Received');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fetchData = async () => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: catData } = await supabase.from('categories').select('*');
        const { data: courseData } = await supabase.from('courses').select('*');
        const { data: enqData } = await supabase
          .from('enquiries')
          .select('*')
          .order('updated_at', { ascending: false });

        if (catData) setCategories(catData);
        if (courseData) setCourses(courseData);
        if (enqData) setEnquiries(enqData);
      } catch (err) {
        console.error('Failed to load conversion data from Supabase, loading local:', err);
        loadLocal();
      }
    } else {
      loadLocal();
    }
  };

  const loadLocal = () => {
    setCategories(getLocalCategories());
    setCourses(getLocalCourses());
    setEnquiries(getLocalEnquiries());
  };

  useEffect(() => {
    fetchData();
  }, [isDemo, refreshTrigger]);

  // Completed tasks from Pending Tasks (all 3 checklist fields non-null)
  const completedTasks = enquiries.filter(
    e => e.interested !== null && e.follow_up_done !== null && e.can_follow_up !== null
  );

  // Interested completed tasks (positive conversion candidates)
  const interestedCompleted = completedTasks.filter(e => e.interested === true);

  // Not interested completed tasks
  const notInterestedCompleted = completedTasks.filter(e => e.interested === false);

  // Already officially converted / enrolled
  const officiallyConverted = completedTasks.filter(
    e => e.notes?.toLowerCase().includes('[converted]') || e.notes?.toLowerCase().includes('enrolled')
  );

  // Metrics
  const totalCompleted = completedTasks.length;
  const conversionRate = totalCompleted > 0 ? ((interestedCompleted.length / totalCompleted) * 100).toFixed(1) : '0';

  // Calculate estimated revenue from completed interested leads
  const totalRevenue = interestedCompleted.reduce((acc, lead) => {
    const course = courses.find(c => c.id === lead.course_id);
    if (!course?.fee) return acc;
    const num = parseInt(course.fee.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? acc : acc + num;
  }, 0);

  const handleOpenConvertModal = (enq: Enquiry) => {
    setConvertingEnquiry(enq);
    setConversionNote(enq.notes ? `${enq.notes} | Admission confirmed.` : 'Admission confirmed and batch assigned.');
    setFeePaidStatus('Full Payment Received');
  };

  const handleConfirmConversion = async () => {
    if (!convertingEnquiry) return;
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const updatedNotes = `[CONVERTED] ${feePaidStatus}. ${conversionNote}`.trim();

      const updates: Partial<Enquiry> = {
        interested: true,
        follow_up_done: true,
        fee_shared: true,
        can_follow_up: false,
        notes: updatedNotes,
        updated_at: now
      };

      if (!isDemo && isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('enquiries')
          .update(updates)
          .eq('id', convertingEnquiry.id);

        if (error) throw error;
      } else {
        updateLocalEnquiry(convertingEnquiry.id, updates);
      }

      setAlertMessage(`🎉 "${convertingEnquiry.contact_name}" admission successfully confirmed!`);
      setConvertingEnquiry(null);
      fetchData();
      onUpdate();

      setTimeout(() => {
        setAlertMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error('Conversion failed:', err);
      alert(`Failed to convert lead: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter list based on selected tab & search query
  const currentList =
    filterTab === 'interested'
      ? interestedCompleted
      : filterTab === 'not_interested'
      ? notInterestedCompleted
      : completedTasks;

  const filteredList = currentList.filter(item => {
    const course = courses.find(c => c.id === item.course_id);
    const text = `${item.contact_name} ${item.contact_phone} ${course?.name} ${item.notes}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--success) / 0.08) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'hsl(var(--success) / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--success))'
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Conversion Module</h2>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted))' }}>
              Tracking all completed details from Pending Tasks and managing student admissions.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onNavigateToLead && (
            <button
              onClick={onNavigateToLead}
              className="btn btn-secondary"
              style={{ fontSize: '13px' }}
            >
              Add New Lead
            </button>
          )}
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="btn btn-ghost"
              style={{ fontSize: '13px' }}
            >
              Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'hsl(var(--success) / 0.15)',
            border: '1px solid hsl(var(--success) / 0.3)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'hsl(var(--success))',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          <Sparkles size={20} />
          <span style={{ flex: 1 }}>{alertMessage}</span>
          <button
            onClick={() => setAlertMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards based on Completed Details from Pending Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Completed from Pending Tasks */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'hsl(var(--primary) / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--primary))'
            }}
          >
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Completed Tasks</div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>
              {totalCompleted}
            </div>
          </div>
        </div>

        {/* Interested in Admission */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'hsl(var(--success) / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--success))'
            }}
          >
            <ThumbsUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Interested / Converted</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'hsl(var(--success))' }}>
              {interestedCompleted.length}
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'hsl(var(--warning) / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--warning))'
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Conversion Rate</div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>
              {conversionRate}%
            </div>
          </div>
        </div>

        {/* Potential Revenue */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'hsl(var(--accent) / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--accent))'
            }}
          >
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Enrolled Tuition</div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>
              ₹{totalRevenue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

      </div>

      {/* Main Completed Tasks & Conversion Ledger */}
      <div className="glass-card">
        
        {/* Navigation & Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '16px' }}>
          
          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterTab('all_completed')}
              className={`btn ${filterTab === 'all_completed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={15} />
              <span>All Completed Tasks ({completedTasks.length})</span>
            </button>

            <button
              onClick={() => setFilterTab('interested')}
              className={`btn ${filterTab === 'interested' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ThumbsUp size={15} />
              <span>Interested / Converted ({interestedCompleted.length})</span>
            </button>

            <button
              onClick={() => setFilterTab('not_interested')}
              className={`btn ${filterTab === 'not_interested' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ThumbsDown size={15} />
              <span>Not Interested ({notInterestedCompleted.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '13px', width: '100%' }}
              placeholder="Search candidate or course..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

        </div>

        {/* Completed Details Table */}
        {filteredList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'hsl(var(--muted))' }}>
            <UserCheck size={36} style={{ color: 'hsl(var(--muted))', display: 'block', margin: '0 auto 12px' }} />
            {completedTasks.length === 0
              ? 'No completed tasks yet. Mark tasks as completed in Pending Tasks to populate this module.'
              : 'No records matching the filter.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Course & Fee</th>
                  <th>Category</th>
                  <th>Contact Phone</th>
                  <th>Completed Checklist Details</th>
                  <th>Details Shared</th>
                  <th>Notes</th>
                  <th>Admission Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(item => {
                  const course = courses.find(c => c.id === item.course_id);
                  const category = categories.find(cat => cat.id === item.category_id);
                  const isConverted = item.notes?.toLowerCase().includes('[converted]') || item.notes?.toLowerCase().includes('enrolled');

                  return (
                    <tr key={item.id}>
                      {/* Name */}
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={14} style={{ color: 'hsl(var(--primary))' }} />
                          <span>{item.contact_name}</span>
                        </div>
                      </td>

                      {/* Course */}
                      <td>
                        <div style={{ fontWeight: 600 }}>{course?.name || 'Course'}</div>
                        {course?.fee && (
                          <div style={{ fontSize: '11px', color: 'hsl(var(--muted))' }}>
                            {course.fee}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td>
                        {category ? (
                          <span className={`badge ${category.name === 'Technologies' ? 'badge-tech' : 'badge-academy'}`}>
                            {category.name}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Phone */}
                      <td>
                        <span style={{ fontSize: '12px' }}>{item.contact_phone || '-'}</span>
                      </td>

                      {/* Completed Checklist Details from Pending Task */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'hsl(var(--muted))' }}>Interested:</span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: item.interested === true ? 'hsl(var(--success))' : 'hsl(var(--danger))'
                              }}
                            >
                              {item.interested === true ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'hsl(var(--muted))' }}>Follow-up:</span>
                            <span style={{ fontWeight: 700, color: 'hsl(var(--success))' }}>
                              {item.follow_up_done === true ? 'Done' : 'Pending'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'hsl(var(--muted))' }}>Reachable:</span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: item.can_follow_up === true ? 'hsl(var(--success))' : 'hsl(var(--danger))'
                              }}
                            >
                              {item.can_follow_up === true ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Fee Shared */}
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: item.fee_shared ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--warning) / 0.15)',
                            color: item.fee_shared ? 'hsl(var(--success))' : 'hsl(var(--warning))'
                          }}
                        >
                          {item.fee_shared ? 'Shared' : 'Pending'}
                        </span>
                      </td>

                      {/* Notes */}
                      <td style={{ maxWidth: '200px' }}>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                          {item.notes || '-'}
                        </div>
                      </td>

                      {/* Admission Status / Convert Button */}
                      <td>
                        {isConverted ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'hsl(var(--success))', fontWeight: 700, fontSize: '12px' }}>
                            <CheckCircle2 size={16} />
                            <span>Admission Confirmed</span>
                          </div>
                        ) : item.interested === true ? (
                          <button
                            onClick={() => handleOpenConvertModal(item)}
                            className="btn btn-primary"
                            style={{
                              fontSize: '11px',
                              padding: '5px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              backgroundColor: 'hsl(var(--success))',
                              borderColor: 'hsl(var(--success))'
                            }}
                          >
                            <ArrowUpRight size={13} />
                            <span>Confirm Admission</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'hsl(var(--danger))', fontWeight: 600 }}>
                            Lead Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Confirm Admission Modal */}
      {convertingEnquiry && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              border: '1px solid hsl(var(--success) / 0.3)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={22} style={{ color: 'hsl(var(--success))' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Confirm Student Admission</h3>
              </div>
              <button
                onClick={() => setConvertingEnquiry(null)}
                style={{ background: 'none', border: 'none', color: 'hsl(var(--muted))', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Completed details summary pill */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'hsl(var(--background))',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--card-border))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
                  {convertingEnquiry.contact_name}
                </div>
                <div style={{ fontSize: '13px', color: 'hsl(var(--muted))' }}>
                  Course: <strong>{courses.find(c => c.id === convertingEnquiry.course_id)?.name || 'Course'}</strong> • {convertingEnquiry.contact_phone}
                </div>
                <div style={{ fontSize: '12px', color: 'hsl(var(--success))', marginTop: '2px' }}>
                  ✓ Checklist completed in Pending Tasks (Interested: Yes, Follow-up: Done, Reachable: Yes)
                </div>
              </div>

              {/* Payment Status Dropdown */}
              <div className="form-group">
                <label className="form-label">Payment & Enrollment Status</label>
                <select
                  className="form-select"
                  value={feePaidStatus}
                  onChange={e => setFeePaidStatus(e.target.value)}
                >
                  <option value="Full Payment Received">Full Payment Received</option>
                  <option value="Partial Fee Paid (Advance)">Partial Fee Paid (Advance)</option>
                  <option value="Admission Confirmed (Payment Pending)">Admission Confirmed (Payment Pending)</option>
                  <option value="Installment Plan Agreed">Installment Plan Agreed</option>
                </select>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Admission / Batch Remarks</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={conversionNote}
                  onChange={e => setConversionNote(e.target.value)}
                  placeholder="Enter batch schedule, admission ID, student details..."
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConvertingEnquiry(null)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmConversion}
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: 'hsl(var(--success))',
                    borderColor: 'hsl(var(--success))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} />
                  <span>{isSubmitting ? 'Confirming...' : 'Confirm Admission'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Conversion;
