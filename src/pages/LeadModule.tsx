import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  BookOpen,
  Phone,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  User,
  Share2,
  CreditCard
} from 'lucide-react';
import {
  getLocalCourses,
  getLocalCategories,
  addLocalEnquiry
} from '../lib/localDatabase';
import type { Course, Category } from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface LeadModuleProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToPendingTasks?: () => void;
  initialContactName?: string;
  onClearPrefill?: () => void;
}

export const LeadModule: React.FC<LeadModuleProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate,
  onNavigateToDashboard,
  onNavigateToPendingTasks,
  initialContactName,
  onClearPrefill
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form Fields
  const [contactName, setContactName] = useState(initialContactName || '');
  const [courseId, setCourseId] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [feeShared, setFeeShared] = useState<'yes' | 'no'>('no');
  const [payment, setPayment] = useState<string>('Pending');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Courses from Course Management & Categories
  const fetchLeadData = async () => {
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: catData } = await supabase.from('categories').select('*');
        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .order('name', { ascending: true });

        if (catData) setCategories(catData);
        if (courseData) setCourses(courseData);
      } catch (err) {
        console.error('Failed to load Supabase data, falling back to local storage:', err);
        loadLocalData();
      }
    } else {
      loadLocalData();
    }
  };

  const loadLocalData = () => {
    setCategories(getLocalCategories());
    const localCourses = getLocalCourses();
    setCourses(localCourses);
  };

  useEffect(() => {
    fetchLeadData();
  }, [isDemo, refreshTrigger]);

  useEffect(() => {
    if (initialContactName !== undefined && initialContactName !== '') {
      setContactName(initialContactName);
    }
  }, [initialContactName]);

  const selectedCourse = courses.find(c => c.id === courseId);
  const selectedCategory = categories.find(cat => cat.id === selectedCourse?.category_id);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setContactPhone(digitsOnly);
  };

  const handleReset = () => {
    setContactName('');
    setCourseId('');
    setContactPhone('');
    setFeeShared('no');
    setPayment('Pending');
    setNotes('');
    setErrorMessage(null);
    if (onClearPrefill) onClearPrefill();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!contactName.trim()) {
      setErrorMessage('Please enter the contact / student name.');
      return;
    }

    if (!courseId) {
      setErrorMessage('Please select a course from Course Management.');
      return;
    }

    if (!contactPhone.trim()) {
      setErrorMessage('Please enter a 10-digit mobile number.');
      return;
    }

    if (contactPhone.length !== 10) {
      setErrorMessage(`Phone number must contain exactly 10 digits (currently ${contactPhone.length}).`);
      return;
    }

    const courseObj = courses.find(c => c.id === courseId);
    if (!courseObj) {
      setErrorMessage('Selected course is invalid. Please pick a course from the list.');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const nextReminder = new Date();
      nextReminder.setDate(now.getDate() + 2); // Default 2-day reminder cycle

      const finalNotes = notes.trim() 
        ? `${notes.trim()} (Payment: ${payment})`
        : `New lead registered via Lead Module. (Payment: ${payment})`;

      if (!isDemo && isSupabaseConfigured() && supabase) {
        const payload: any = {
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          category_id: courseObj.category_id,
          course_id: courseObj.id,
          fee_shared: feeShared === 'yes',
          payment: payment,
          notes: finalNotes,
          interested: null,
          follow_up_done: null,
          can_follow_up: null,
          next_reminder_at: nextReminder.toISOString(),
          last_reminded_at: null
        };

        const { error } = await supabase.from('enquiries').insert([payload]);

        if (error) {
          // If error is about missing column 'payment', fallback without it
          if (error.message?.includes('payment') || error.code === 'PGRST204') {
            const { payment: _, ...fallbackPayload } = payload;
            const { error: fallbackError } = await supabase.from('enquiries').insert([fallbackPayload]);
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
      } else {
        addLocalEnquiry({
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          category_id: courseObj.category_id,
          course_id: courseObj.id,
          fee_shared: feeShared === 'yes',
          payment: payment,
          notes: finalNotes,
          interested: null,
          follow_up_done: null,
          can_follow_up: null
        });
      }

      setSuccessMessage(`Lead "${contactName.trim()}" for ${courseObj.name} registered! Transferring details to Pending Tasks...`);
      onUpdate();

      // Automatically transition to Pending Tasks so the user immediately sees the details there
      setTimeout(() => {
        handleReset();
        if (onClearPrefill) onClearPrefill();
        if (onNavigateToPendingTasks) {
          onNavigateToPendingTasks();
        }
      }, 750);
    } catch (err: any) {
      console.error('Error creating lead:', err);
      setErrorMessage(`Failed to save lead: ${err.message || 'Unknown error occurred.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      
      {/* Top Banner / Intro */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.08) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'hsl(var(--primary) / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--primary))'
            }}
          >
            <UserPlus size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Lead Entry & Registration</h2>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted))' }}>
              Add new student or client enquiries. Courses are loaded live from Course Management.
            </p>
          </div>
        </div>

        {onNavigateToDashboard && (
          <button
            onClick={onNavigateToDashboard}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
          >
            <span>View New Enquiries</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'hsl(var(--success) / 0.12)',
            border: '1px solid hsl(var(--success) / 0.3)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'hsl(var(--success))',
            fontSize: '14px',
            fontWeight: 500,
            flexWrap: 'wrap'
          }}
        >
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: '220px' }}>{successMessage}</span>
          {onNavigateToPendingTasks && (
            <button
              onClick={() => {
                handleReset();
                if (onClearPrefill) onClearPrefill();
                onNavigateToPendingTasks();
              }}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              Go to Pending Tasks Now →
            </button>
          )}
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'hsl(var(--danger) / 0.12)',
            border: '1px solid hsl(var(--danger) / 0.3)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'hsl(var(--danger))',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          <AlertCircle size={20} />
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Lead Creation Form Card */}
      <div className="glass-card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', borderBottom: '1px solid hsl(var(--card-border))', paddingBottom: '14px' }}>
          <Sparkles size={20} style={{ color: 'hsl(var(--primary))' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 700 }}>New Lead Details</h3>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Row 1: Name & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} style={{ color: 'hsl(var(--primary))' }} />
                <span>Name *</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Ramesh Chandra"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} style={{ color: 'hsl(var(--primary))' }} />
                <span>Phone Number *</span>
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder="e.g. 9876543210"
                value={contactPhone}
                onChange={handlePhoneChange}
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]{10}"
                required
              />
            </div>
          </div>

          {/* Row 2: Course (left) & Details Shared + Payment (right) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', alignItems: 'start' }}>
            {/* Course Field (Dropdown from Course Management) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={14} style={{ color: 'hsl(var(--primary))' }} />
                  <span>Course * (from Course Management)</span>
                </label>
                <select
                  className="form-select"
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                  required
                >
                  <option value="">-- Select Created Course --</option>
                  {courses.length === 0 ? (
                    <option value="" disabled>No courses found in Course Management</option>
                  ) : (
                    courses.map(course => {
                      const cat = categories.find(c => c.id === course.category_id);
                      return (
                        <option key={course.id} value={course.id}>
                          {course.name} {course.fee ? `(${course.fee})` : ''} {cat ? `• ${cat.name}` : ''}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              {/* Course detail preview pill */}
              {selectedCourse && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--card-border))',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      {selectedCourse.name}
                    </span>
                    {selectedCategory && (
                      <span
                        className={`badge ${selectedCategory.name === 'Technologies' ? 'badge-tech' : 'badge-academy'}`}
                        style={{ marginLeft: '10px', fontSize: '11px' }}
                      >
                        {selectedCategory.name}
                      </span>
                    )}
                    {selectedCourse.description && (
                      <div style={{ color: 'hsl(var(--muted))', marginTop: '4px', fontSize: '12px' }}>
                        {selectedCourse.description}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: 'hsl(var(--primary))', fontSize: '14px', whiteSpace: 'nowrap' }}>
                    {selectedCourse.fee || 'Fee not specified'}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Details Shared & Payment under it */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Details Shared Field (formerly Fee Shared) */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Share2 size={14} style={{ color: 'hsl(var(--primary))' }} />
                  <span>Details Shared (yes/no) *</span>
                </label>
                <select
                  className="form-select"
                  value={feeShared}
                  onChange={e => setFeeShared(e.target.value as 'yes' | 'no')}
                  required
                >
                  <option value="no">No (Details yet to be communicated)</option>
                  <option value="yes">Yes (Details discussed & shared)</option>
                </select>
              </div>

              {/* Payment Field (Dropdown under Details Shared) */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} style={{ color: 'hsl(var(--primary))' }} />
                  <span>Payment *</span>
                </label>
                <select
                  className="form-select"
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                  required
                >
                  <option value="Pending">Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes Field */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} style={{ color: 'hsl(var(--primary))' }} />
              <span>Notes</span>
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="e.g. Inquired about weekend batch, interested in demo lecture, student background..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 28px', minWidth: '160px' }}
            >
              <CheckCircle2 size={17} />
              <span>{isSubmitting ? 'Saving Lead...' : 'Save Lead'}</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};

export default LeadModule;
