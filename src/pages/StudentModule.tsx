import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  BookOpen,
  Search,
  Users,
  Phone,
  Calendar,
  CheckCircle2,
  Sparkles,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Code,
  User,
  Clock,
  Laptop,
  CreditCard,
  Layers,
  X
} from 'lucide-react';
import { getLocalCourses, getLocalCategories, getLocalEnquiries } from '../lib/localDatabase';
import type { Course, Category, Enquiry } from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getCourseCoverImage, getCourseDuration } from './Courses';

interface StudentProps {
  isDemo: boolean;
  refreshTrigger: number;
  onUpdate: () => void;
  onNavigateToLead?: (prefillName?: string) => void;
}

export const StudentModule: React.FC<StudentProps> = ({
  isDemo,
  refreshTrigger,
  onUpdate,
  onNavigateToLead
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Selected course for navigating to its dedicated Registered Student Details page
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Search and filter inside the student details page
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved' | 'pending'>('all');

  const fetchStudentData = async () => {
    setIsLoading(true);
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: catData } = await supabase.from('categories').select('*');
        const { data: courseData } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
        const { data: enqData } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });

        if (catData) setCategories(catData);
        if (courseData) setCourses(courseData);
        if (enqData) setEnquiries(enqData);
      } catch (err) {
        console.error('Failed to load Supabase data for Student portal, using local storage:', err);
        loadLocalData();
      }
    } else {
      loadLocalData();
    }
    setIsLoading(false);
  };

  const loadLocalData = () => {
    setCategories(getLocalCategories());
    setCourses(getLocalCourses());
    setEnquiries(getLocalEnquiries());
  };

  useEffect(() => {
    fetchStudentData();
  }, [isDemo, refreshTrigger]);

  // Filter courses by search and category
  const filteredCourses = courses.filter(course => {
    const category = categories.find(c => c.id === course.category_id);
    const categoryMatch = selectedCategory === 'all' || course.category_id === selectedCategory;

    const q = searchTerm.toLowerCase().trim();
    if (!q) return categoryMatch;

    const courseNameMatch = course.name.toLowerCase().includes(q);
    const courseDescMatch = course.description.toLowerCase().includes(q);
    const courseFeeMatch = course.fee.toLowerCase().includes(q);
    const catNameMatch = category?.name.toLowerCase().includes(q);

    // Also match if any student under this course matches
    const studentMatch = enquiries.some(
      e => e.course_id === course.id && (
        e.contact_name.toLowerCase().includes(q) ||
        (e.contact_phone && e.contact_phone.toLowerCase().includes(q))
      )
    );

    return categoryMatch && (courseNameMatch || courseDescMatch || courseFeeMatch || catNameMatch || studentMatch);
  });

  // Calculate statistics
  const totalStudents = enquiries.length;
  const activeCoursesCount = courses.filter(c => c.active).length;

  // -------------------------------------------------------------
  // VIEW 2: DEDICATED REGISTERED STUDENT DETAILS PAGE
  // -------------------------------------------------------------
  if (selectedCourseId) {
    const activeCourse = courses.find(c => c.id === selectedCourseId);
    if (activeCourse) {
      const activeCategory = categories.find(c => c.id === activeCourse.category_id);
      const courseDuration = getCourseDuration(activeCourse);
      const allCourseStudents = enquiries.filter(e => e.course_id === activeCourse.id);

      // Filter students inside this course page
      const filteredStudents = allCourseStudents.filter(student => {
        const matchesSearch =
          student.contact_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          (student.contact_phone && student.contact_phone.includes(studentSearch)) ||
          (student.notes && student.notes.toLowerCase().includes(studentSearch.toLowerCase()));

        const isResolved = student.interested !== null && student.follow_up_done !== null && student.can_follow_up !== null;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'resolved' && isResolved) ||
          (statusFilter === 'pending' && !isResolved);

        return matchesSearch && matchesStatus;
      });

      const resolvedCount = allCourseStudents.filter(e => e.interested !== null && e.follow_up_done !== null && e.can_follow_up !== null).length;
      const pendingCount = allCourseStudents.length - resolvedCount;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Top Bar: Back Button & Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <button
              onClick={() => setSelectedCourseId(null)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 700 }}
            >
              <ArrowLeft size={16} />
              <span>Back to All Courses</span>
            </button>

            <div style={{ fontSize: '13px', color: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Student Module</span>
              <span>/</span>
              <span style={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>{activeCourse.name}</span>
            </div>
          </div>

          {/* Course Details Header Banner */}
          <div
            className="glass-card"
            style={{
              padding: '24px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px',
              background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.08) 100%)',
              border: '1.5px solid hsl(var(--card-border))',
              borderRadius: '16px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span className={`badge ${activeCategory?.name === 'Technologies' ? 'badge-tech' : 'badge-academy'}`}>
                  {activeCategory?.name || 'General'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: activeCourse.active ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--muted) / 0.2)',
                    color: activeCourse.active ? 'hsl(var(--success))' : 'hsl(var(--muted))'
                  }}
                >
                  {activeCourse.active ? 'Active Program' : 'Archived'}
                </span>
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: 'hsl(var(--foreground))' }}>
                {activeCourse.name} — Registered Students
              </h2>
              <p style={{ fontSize: '14px', color: 'hsl(var(--muted))', margin: 0, lineHeight: 1.5 }}>
                {activeCourse.description || 'Viewing all registered students and enquiries enrolled under this course.'}
              </p>
            </div>

            {/* Course Summary Badges */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 18px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted))', fontWeight: 700, textTransform: 'uppercase' }}>Tuition Fee</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'hsl(var(--primary))' }}>{activeCourse.fee || 'N/A'}</div>
              </div>

              <div style={{ padding: '10px 18px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted))', fontWeight: 700, textTransform: 'uppercase' }}>Duration</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#0284c7' }}>{courseDuration}</div>
              </div>

              <div style={{ padding: '10px 18px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted))', fontWeight: 700, textTransform: 'uppercase' }}>Enrolled</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>{allCourseStudents.length} Students</div>
              </div>

              {onNavigateToLead && (
                <button
                  onClick={() => onNavigateToLead(activeCourse.name)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontWeight: 700, borderRadius: '10px' }}
                >
                  <UserPlus size={16} />
                  <span>+ Register Student</span>
                </button>
              )}
            </div>
          </div>

          {/* Student Search & Status Filter Bar */}
          <div
            className="glass-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '16px 20px'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setStatusFilter('all')}
                className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '13px', padding: '6px 14px' }}
              >
                All Students ({allCourseStudents.length})
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`btn ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '13px', padding: '6px 14px' }}
              >
                Resolved / Admitted ({resolvedCount})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`btn ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '13px', padding: '6px 14px' }}
              >
                Follow-up Pending ({pendingCount})
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
              <input
                type="text"
                placeholder="Search registered students..."
                className="form-input"
                style={{ paddingLeft: '36px', fontSize: '13px' }}
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Student Cards Roster */}
          {filteredStudents.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--muted))' }}>
              <Users size={36} style={{ color: 'hsl(var(--muted))', display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0' }}>
                {allCourseStudents.length === 0
                  ? `No students currently registered for ${activeCourse.name}.`
                  : 'No students match your search filter.'}
              </p>
              {allCourseStudents.length === 0 && onNavigateToLead && (
                <button
                  onClick={() => onNavigateToLead(activeCourse.name)}
                  className="btn btn-primary"
                  style={{ marginTop: '12px' }}
                >
                  Register First Student →
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
              {filteredStudents.map(student => {
                const isResolved = student.interested !== null && student.follow_up_done !== null && student.can_follow_up !== null;

                return (
                  <div
                    key={student.id}
                    className="glass-card"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      border: '1px solid hsl(var(--card-border))',
                      borderRadius: '14px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'hsl(var(--primary) / 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'hsl(var(--primary))'
                          }}
                        >
                          <User size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '15.5px', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
                            {student.contact_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'hsl(var(--muted))' }}>
                            Enrolled: {new Date(student.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          backgroundColor: isResolved ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--warning) / 0.15)',
                          color: isResolved ? 'hsl(var(--success))' : 'hsl(var(--warning))'
                        }}
                      >
                        {isResolved ? 'Resolved / Admitted' : 'Pending Follow-up'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                      <a
                        href={`tel:${student.contact_phone}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none' }}
                        title="Click to call student"
                      >
                        <Phone size={14} style={{ color: '#1f4854' }} />
                        <span style={{ fontWeight: 600 }}>{student.contact_phone || 'No phone provided'}</span>
                      </a>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={14} style={{ color: student.fee_shared ? 'hsl(var(--success))' : 'hsl(var(--muted))' }} />
                        <span>Details Shared: <strong style={{ color: student.fee_shared ? 'hsl(var(--success))' : 'hsl(var(--muted))' }}>{student.fee_shared ? 'Yes' : 'No'}</strong></span>
                      </div>

                      {student.next_reminder_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={14} style={{ color: '#ea580c' }} />
                          <span>Next Reminder: {new Date(student.next_reminder_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {student.notes && (
                      <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontStyle: 'italic', backgroundColor: 'hsl(var(--background))', padding: '8px 12px', borderRadius: '8px', border: '1px solid hsl(var(--card-border))' }}>
                        "{student.notes}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
  }

  // -------------------------------------------------------------
  // VIEW 1: COURSES CATALOG VIEW (MATCHING ATTACHED UI REFERENCE)
  // -------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Top Banner / Metrics Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Total Created Courses</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{courses.length}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Total Registered Students</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{totalStudents}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))' }}>
            <GraduationCap size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Active Programs</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{activeCoursesCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px'
        }}
      >
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`btn ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            All Courses ({courses.length})
          </button>
          {categories.map(cat => {
            const count = courses.filter(c => c.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '13px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {cat.name === 'Technologies' ? <Code size={14} /> : <GraduationCap size={14} />}
                <span>{cat.name} ({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
          <input
            type="text"
            placeholder="Search course or student name..."
            className="form-input"
            style={{ paddingLeft: '36px', fontSize: '13px', width: '100%' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Courses Grid with Cards Matching Reference Image */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0' }}>
              Created Courses ({filteredCourses.length})
            </h2>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted))', margin: 0 }}>
              Click <strong>Get Student Details</strong> on any course card to view its registered students on a dedicated page.
            </p>
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--muted))' }}>
            <BookOpen size={36} style={{ color: 'hsl(var(--muted))', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px 0' }}>No courses match your selection.</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Create new courses in Course Management to view them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
            {filteredCourses.map(course => {
              const category = categories.find(c => c.id === course.category_id);
              const courseStudents = enquiries.filter(e => e.course_id === course.id);
              const duration = getCourseDuration(course);
              const coverImage = getCourseCoverImage(course);

              return (
                <div
                  key={course.id}
                  id={`course-card-${course.id}`}
                  className="app-course-card"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  {/* Top Photographic Banner with Best Seller Badge (matching reference UI) */}
                  <div className="app-course-banner" style={{ height: '165px' }}>
                    <img
                      src={coverImage}
                      alt={course.name}
                      className="app-course-banner-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="app-course-banner-overlay" />

                    {/* Best Seller / Domain Badge on Top-Left */}
                    <div className="bestseller-badge">
                      Best Seller
                    </div>
                  </div>

                  {/* Card Body */}
                  <div
                    className="app-course-body"
                    style={{
                      padding: '22px 20px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      flex: 1
                    }}
                  >
                    {/* Course Title */}
                    <h3
                      className="app-course-title"
                      style={{ fontSize: '19px', fontWeight: 800, margin: 0, color: 'hsl(var(--foreground))' }}
                    >
                      {course.name}
                    </h3>

                    {/* Blue Underline Accent Line (matching reference UI) */}
                    <div className="course-card-accent-line" />

                    {/* Course Description */}
                    {course.description && (
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'hsl(var(--muted))',
                          margin: '2px 0 6px 0',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {course.description}
                      </p>
                    )}

                    {/* 4 Feature Rows with Circular Pastel Icon Badges (matching reference UI) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', margin: '4px 0 12px 0' }}>
                      {/* 1. Duration (Cyan circle) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'hsl(var(--muted-foreground))' }}>
                        <div className="feature-circle-icon" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                          <Clock size={15} />
                        </div>
                        <span>Duration: <strong style={{ color: 'hsl(var(--foreground))' }}>{duration}</strong></span>
                      </div>

                      {/* 2. Registered Students (Amber circle) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'hsl(var(--muted-foreground))' }}>
                        <div className="feature-circle-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                          <Users size={15} />
                        </div>
                        <span>Enrolled: <strong style={{ color: 'hsl(var(--foreground))' }}>{courseStudents.length} Registered Students</strong></span>
                      </div>

                      {/* 3. Tuition Fee (Blue circle) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'hsl(var(--muted-foreground))' }}>
                        <div className="feature-circle-icon" style={{ backgroundColor: '#d2ebf1', color: '#1f4854' }}>
                          <CreditCard size={15} />
                        </div>
                        <span>Tuition Fee: <strong style={{ color: 'hsl(var(--primary))', fontSize: '14.5px' }}>{course.fee || 'Contact for fee'}</strong></span>
                      </div>

                      {/* 4. Training Mode (Green circle) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'hsl(var(--muted-foreground))' }}>
                        <div className="feature-circle-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                          <Laptop size={15} />
                        </div>
                        <span>Learning Mode: <strong style={{ color: 'hsl(var(--foreground))' }}>Online + Offline</strong></span>
                      </div>
                    </div>

                    {/* Centered Solid Blue Button: Get Student Details (navigates to dedicated page) */}
                    <button
                      className="btn-get-student-details"
                      onClick={() => setSelectedCourseId(course.id)}
                      title={`Open registered student details for ${course.name}`}
                    >
                      <span>Get Student Details</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentModule;
