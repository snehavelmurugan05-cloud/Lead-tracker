import React, { useState, useEffect } from 'react';
import {
  Search,
  GraduationCap,
  Code,
  Clock,
  Laptop,
  CreditCard,
  BookOpen,
  X,
  CheckCircle2,
  Phone,
  Layers
} from 'lucide-react';
import { getLocalCourses, getLocalCategories } from '../lib/localDatabase';
import type { Course, Category } from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface CoursesProps {
  isDemo: boolean;
  refreshTrigger: number;
  onNavigateToLead?: (prefillName?: string) => void;
}

// Helper to provide tailored course cover images based on category / domain
export const getCourseCoverImage = (course: Course): string => {
  const name = course.name.toLowerCase();

  if (name.includes('full stack') || name.includes('web') || name.includes('dev') || name.includes('code')) {
    return 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('data') || name.includes('analyst') || name.includes('sql')) {
    return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('science') || name.includes('ai') || name.includes('machine')) {
    return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('neet') || name.includes('medical')) {
    return 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('jee') || name.includes('eng')) {
    return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80';
  }
  if (name.includes('german') || name.includes('language')) {
    return 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80';
};

// Helper to provide duration based on real course data
export const getCourseDuration = (course: Course): string => {
  const name = course.name.toLowerCase();
  const fee = (course.fee || '').toLowerCase();
  const desc = (course.description || '').toLowerCase();

  if (fee.includes('/year') || name.includes('neet') || name.includes('jee')) {
    return '1 Year Program';
  }
  if (name.includes('data science') || name.includes('full stack')) {
    return '6 Months';
  }
  if (name.includes('machine learning')) {
    return '4 Months';
  }
  if (name.includes('german') || fee.includes('/level')) {
    return '2.5 Months (Per Level)';
  }
  if (desc.includes('month') || desc.includes('year')) {
    const match = desc.match(/(\d+(\.\d+)?\s*(months?|years?))/i);
    if (match) return match[0];
  }
  return '3 - 6 Months';
};

export const Courses: React.FC<CoursesProps> = ({ isDemo, refreshTrigger, onNavigateToLead }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal state for View Details
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState<Course | null>(null);

  const fetchCatalogData = async () => {
    setIsLoading(true);
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: catData } = await supabase.from('categories').select('*');
        const { data: courseData } = await supabase.from('courses').select('*').eq('active', true);

        if (catData) setCategories(catData);
        if (courseData) setCourses(courseData);
      } catch (err) {
        console.error('Failed to load from Supabase catalog, loading local:', err);
        setCategories(getLocalCategories());
        setCourses(getLocalCourses());
      }
    } else {
      setCategories(getLocalCategories());
      setCourses(getLocalCourses());
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCatalogData();
  }, [isDemo, refreshTrigger]);

  const filteredCourses = courses.filter(course => {
    const matchesSearch =
      course.name.toLowerCase().includes(search.toLowerCase()) ||
      course.description.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === 'all' ||
      course.category_id === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const handleEnrollNow = (course: Course) => {
    if (onNavigateToLead) {
      onNavigateToLead(course.name);
    } else {
      setSelectedCourseForDetails(course);
    }
  };

  return (
    <div className="courses-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Search and Filters Header */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCategory('all')}
            className={`btn ${activeCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Offerings
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`btn ${activeCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {cat.name === 'Technologies' ? <Code size={14} /> : <GraduationCap size={14} />}
              {cat.name}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))', display: 'flex', alignItems: 'center' }}>
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search courses..."
            className="form-input"
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--muted))' }}>
          Loading course catalog...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

          {categories
            .filter(cat => activeCategory === 'all' || activeCategory === cat.id)
            .map(cat => {
              const catCourses = filteredCourses.filter(c => c.category_id === cat.id);
              if (catCourses.length === 0) return null;

              return (
                <div key={cat.id}>
                  <h3 className="courses-section-title">
                    {cat.name === 'Technologies' ? <Code size={18} /> : <GraduationCap size={18} />}
                    {cat.name} Courses ({catCourses.length})
                  </h3>

                  <div className="courses-grid">
                    {catCourses.map(course => {
                      const duration = getCourseDuration(course);
                      const coverImage = getCourseCoverImage(course);

                      return (
                        <div key={course.id} className="app-course-card">
                          {/* Top Photographic Banner */}
                          <div className="app-course-banner">
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

                            {/* Category & Status Pill Badge on Banner */}
                            <div className="app-course-banner-badge">
                              <span style={{ color: '#60a5fa' }}>●</span>
                              <span>{cat.name}</span>
                              <span style={{ opacity: 0.5 }}>|</span>
                              <span style={{ color: '#4ade80' }}>Admissions Open</span>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="app-course-body">
                            {/* Course Title */}
                            <h3 className="app-course-title">
                              {course.name}
                            </h3>

                            {/* Real Course Metadata Rows */}
                            <div className="app-course-meta-list">
                              {/* 1. Tuition Fee (Prominent Highlight) */}
                              <div className="app-course-meta-item">
                                <CreditCard size={16} />
                                <span>Tuition Fee: <strong className="fee-highlight">{course.fee || 'Contact for fee'}</strong></span>
                              </div>

                              {/* 2. Duration */}
                              <div className="app-course-meta-item">
                                <Clock size={16} />
                                <span>Duration: <strong style={{ color: 'hsl(var(--foreground))' }}>{duration}</strong></span>
                              </div>

                              {/* 3. Learning Mode */}
                              <div className="app-course-meta-item">
                                <Laptop size={16} />
                                <span>Training Mode: <strong style={{ color: 'hsl(var(--foreground))' }}>Online + Offline</strong></span>
                              </div>

                              {/* 4. Domain / Category */}
                              <div className="app-course-meta-item">
                                <Layers size={16} />
                                <span>Category: <strong style={{ color: 'hsl(var(--foreground))' }}>{cat.name}</strong></span>
                              </div>
                            </div>

                            {/* Brief Course Overview */}
                            {course.description && (
                              <p
                                style={{
                                  fontSize: '12.5px',
                                  color: 'hsl(var(--muted))',
                                  margin: '2px 0 0 0',
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

                            {/* Action Buttons: Enquire Now & View Details */}
                            <div className="app-course-actions">
                              <button
                                className="btn-course-enquire"
                                onClick={() => handleEnrollNow(course)}
                                title="Enroll or register a lead for this course"
                              >
                                <span>Enroll Now →</span>
                              </button>

                              <button
                                className="btn-course-details"
                                onClick={() => setSelectedCourseForDetails(course)}
                              >
                                <span>View Details &gt;</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {filteredCourses.length === 0 && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--muted))' }}>
              No course matches the selected search criteria.
            </div>
          )}
        </div>
      )}

      {/* Course Details Modal */}
      {selectedCourseForDetails && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedCourseForDetails(null)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '20px',
              padding: '0',
              backgroundColor: 'hsl(var(--card))',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              border: '1px solid hsl(var(--card-border))',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header Banner */}
            <div
              className="app-course-banner"
              style={{
                height: '140px'
              }}
            >
              <img
                src={getCourseCoverImage(selectedCourseForDetails)}
                alt={selectedCourseForDetails.name}
                className="app-course-banner-img"
              />
              <div className="app-course-banner-overlay" />
              <div className="app-course-banner-badge">
                <span style={{ color: '#4ade80' }}>●</span>
                <span>Admissions Open</span>
              </div>

              <button
                onClick={() => setSelectedCourseForDetails(null)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  zIndex: 3
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0' }}>
                  {selectedCourseForDetails.name}
                </h3>
                <p style={{ fontSize: '14px', color: 'hsl(var(--muted))', lineHeight: 1.5, margin: 0 }}>
                  {selectedCourseForDetails.description || 'Comprehensive curriculum designed for practical mastery and industry career progression.'}
                </p>
              </div>

              {/* Course Highlights Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                    Tuition Fee
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: 'hsl(var(--primary))' }}>
                    {selectedCourseForDetails.fee || 'Contact for fee'}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                    Duration
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1f4854', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} />
                    <span>{getCourseDuration(selectedCourseForDetails)}</span>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                    Learning Mode
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Laptop size={16} />
                    <span>Online + Offline</span>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--card-border))' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted))', marginBottom: '4px' }}>
                    Status
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: selectedCourseForDetails.active ? 'hsl(var(--success))' : 'hsl(var(--muted))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} />
                    <span>{selectedCourseForDetails.active ? 'Admissions Open' : 'Archived'}</span>
                  </div>
                </div>
              </div>

              {/* What's Included */}
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'hsl(var(--primary) / 0.06)', border: '1px solid hsl(var(--primary) / 0.15)' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'hsl(var(--primary))', marginBottom: '8px' }}>
                  Course Offerings & Highlights
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: 'hsl(var(--foreground))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: 'hsl(var(--success))' }} />
                    <span>Interactive classroom & online live mentoring sessions</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: 'hsl(var(--success))' }} />
                    <span>Comprehensive syllabus & hands-on practical assignments</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: 'hsl(var(--success))' }} />
                    <span>Dedicated student doubt clearing & personalized progress tracking</span>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setSelectedCourseForDetails(null)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 18px' }}
                >
                  Close
                </button>
                {onNavigateToLead && (
                  <button
                    onClick={() => {
                      const cName = selectedCourseForDetails.name;
                      setSelectedCourseForDetails(null);
                      onNavigateToLead(cName);
                    }}
                    className="btn btn-primary"
                    style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Phone size={15} />
                    <span>Enquire for this Course →</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
