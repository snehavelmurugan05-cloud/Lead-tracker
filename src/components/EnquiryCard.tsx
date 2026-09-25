import React from 'react';
import {
  Phone,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MoreVertical,
  Edit
} from 'lucide-react';
import type { Enquiry, Course, Category } from '../lib/localDatabase';

interface EnquiryCardProps {
  enquiry: Enquiry;
  courses: Course[];
  categories: Category[];
  onEdit?: (enquiry: Enquiry) => void;
  onToggleStatus?: (
    enquiry: Enquiry,
    field: 'interested' | 'follow_up_done' | 'can_follow_up',
    currentVal: boolean | null
  ) => void;
}

export const EnquiryCard: React.FC<EnquiryCardProps> = ({
  enquiry,
  courses,
  categories,
  onEdit,
  onToggleStatus
}) => {
  const course = courses.find(c => c.id === enquiry.course_id);
  const category = categories.find(c => c.id === enquiry.category_id);

  // Initial letter from customer name
  const initialLetter = enquiry.contact_name
    ? enquiry.contact_name.trim().charAt(0).toUpperCase()
    : 'L';

  // Format date: "Registered Sep 18, 2026"
  const formattedDate = new Date(enquiry.created_at).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Calculate answered count out of 3
  const answeredCount = [
    enquiry.interested,
    enquiry.follow_up_done,
    enquiry.can_follow_up
  ].filter(val => val !== null).length;

  // Check if reminder is due
  const isReminderDue = new Date(enquiry.next_reminder_at) <= new Date();

  // Helper for rendering segment color in tracking progress bar
  const getSegmentColor = (val: boolean | null) => {
    if (val === true) return '#389d77'; // Green
    if (val === false) return '#e05342'; // Coral red
    return '#a4c4cf'; // Slate / pending
  };

  // Helper for rendering the 3 status pills
  const renderStatusButton = (
    field: 'interested' | 'follow_up_done' | 'can_follow_up',
    val: boolean | null,
    label: string
  ) => {
    let bg = '#fef3d6';
    let border = '#fbe3a8';
    let text = '#a16207';
    let statusText = 'Pending';
    let IconComponent = HelpCircle;

    if (val === true) {
      bg = '#d9f5e5';
      border = '#b7eccd';
      text = '#127a52';
      statusText = 'Yes';
      IconComponent = CheckCircle2;
    } else if (val === false) {
      bg = '#fde8e4';
      border = '#f9cac2';
      text = '#c0392b';
      statusText = 'No';
      IconComponent = XCircle;
    }

    return (
      <button
        type="button"
        onClick={() => {
          if (onToggleStatus) {
            onToggleStatus(enquiry, field, val);
          } else if (onEdit) {
            onEdit(enquiry);
          }
        }}
        title={`Click to cycle status for ${label} (Current: ${statusText})`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '8px 4px',
          borderRadius: '8px',
          backgroundColor: bg,
          border: `1px solid ${border}`,
          color: text,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          fontFamily: 'inherit',
          width: '100%'
        }}
      >
        <IconComponent size={15} />
        <span style={{ fontSize: '10.5px', fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: '10px', opacity: 0.9 }}>{statusText}</span>
      </button>
    );
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid #d4e5ec',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 10px rgba(31, 72, 84, 0.04)'
      }}
    >
      <div>
        {/* Card Header: Avatar Initial, Name, Date, 3-dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#d2f0e3',
                color: '#1b7a5a',
                fontSize: '16px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {initialLetter}
            </div>

            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#162e3b', lineHeight: 1.2 }}>
                {enquiry.contact_name}
              </div>
              <div style={{ fontSize: '11.5px', color: '#7898a5', marginTop: '2px' }}>
                Registered {formattedDate}
              </div>
            </div>
          </div>

          {onEdit && (
            <button
              onClick={() => onEdit(enquiry)}
              style={{
                background: 'none',
                border: 'none',
                color: '#8fb0bd',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Edit Lead Details"
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>

        {/* Division Badge & Reminder Due Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: '6px',
              backgroundColor: '#c4dce6',
              color: '#274d5b'
            }}
          >
            {category?.name || 'General'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#477765' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isReminderDue ? '#10b981' : '#a4c4cf'
              }}
            />
            <span>{isReminderDue ? 'Reminder due' : 'Scheduled'}</span>
          </div>
        </div>

        {/* Course Name & Fee */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#162e3b' }}>
            {course?.name || 'Program Enquiry'}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#245869' }}>
            {course?.fee || ''}
          </span>
        </div>

        {/* Tracking Progress Bar & Label */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#688896', fontWeight: 600, marginBottom: '6px' }}>
            <span>Tracking progress</span>
            <span>{answeredCount} of 3 answered</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
            <div style={{ height: '4px', borderRadius: '2px', backgroundColor: getSegmentColor(enquiry.interested) }} />
            <div style={{ height: '4px', borderRadius: '2px', backgroundColor: getSegmentColor(enquiry.follow_up_done) }} />
            <div style={{ height: '4px', borderRadius: '2px', backgroundColor: getSegmentColor(enquiry.can_follow_up) }} />
          </div>
        </div>

        {/* 3 Status Buttons (Interested, Follow-up, Reachable) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {renderStatusButton('interested', enquiry.interested, 'Interested')}
          {renderStatusButton('follow_up_done', enquiry.follow_up_done, 'Follow-up')}
          {renderStatusButton('can_follow_up', enquiry.can_follow_up, 'Reachable')}
        </div>
      </div>

      {/* Footer Contact Details & Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
        {enquiry.contact_phone && (
          <a
            href={`tel:${enquiry.contact_phone}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#355c6b',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            <Phone size={13} style={{ color: '#6a8f9e' }} />
            <span>{enquiry.contact_phone}</span>
          </a>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#4f7280', fontSize: '12.5px', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: '#6a8f9e' }}>•</span>
            <span>Details shared: <strong style={{ color: enquiry.fee_shared ? '#1ba37c' : '#4f7280' }}>{enquiry.fee_shared ? 'Yes' : 'No'}</strong></span>
          </div>
          {enquiry.payment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Payment: <strong style={{ 
                color: enquiry.payment === 'Completed' ? '#1ba37c' : enquiry.payment === 'Partially Paid' ? '#d97706' : '#64748b' 
              }}>{enquiry.payment}</strong></span>
            </div>
          )}
        </div>

        {enquiry.notes && (
          <div
            style={{
              fontSize: '12px',
              color: '#688896',
              fontStyle: 'italic',
              marginTop: '4px',
              lineHeight: 1.4
            }}
          >
            "{enquiry.notes}"
          </div>
        )}
      </div>
    </div>
  );
};

export default EnquiryCard;
