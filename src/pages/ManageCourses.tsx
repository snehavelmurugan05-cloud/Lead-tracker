import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, PlusCircle, Check } from 'lucide-react';
import { 
  getLocalCourses, 
  getLocalCategories, 
  saveLocalCourse, 
  saveLocalCategory,
  deleteLocalCourse 
} from '../lib/localDatabase';
import type { Course, Category } from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ManageCoursesProps {
  isDemo: boolean;
  onUpdate: () => void;
  refreshTrigger: number;
}

export const ManageCourses: React.FC<ManageCoursesProps> = ({ 
  isDemo, 
  onUpdate,
  refreshTrigger
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Category Form State
  const [catName, setCatName] = useState('');
  
  // Course Form State
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [courseCategoryId, setCourseCategoryId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseFee, setCourseFee] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseActive, setCourseActive] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data: cats } = await supabase.from('categories').select('*');
        const { data: crs } = await supabase.from('courses').select('*');
        if (cats) {
          setCategories(cats);
          if (cats.length > 0 && !courseCategoryId) setCourseCategoryId(cats[0].id);
        }
        if (crs) setCourses(crs);
      } catch (err) {
        console.error('Supabase load failed, fetching local:', err);
        loadLocalData();
      }
    } else {
      loadLocalData();
    }
    setIsLoading(false);
  };

  const loadLocalData = () => {
    const cats = getLocalCategories();
    const crs = getLocalCourses();
    setCategories(cats);
    setCourses(crs);
    if (cats.length > 0 && !courseCategoryId) {
      setCourseCategoryId(cats[0].id);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isDemo, refreshTrigger]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase
          .from('categories')
          .insert([{ name: catName }])
          .select();
        if (error) throw error;
      } catch (err: any) {
        alert(`Supabase Error: ${err.message}`);
      }
    } else {
      saveLocalCategory(catName);
    }

    setCatName('');
    fetchData();
    onUpdate();
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim() || !courseFee.trim() || !courseCategoryId) {
      alert('Please fill out Name, Fee, and Category.');
      return;
    }

    const courseData = {
      category_id: courseCategoryId,
      name: courseName,
      fee: courseFee,
      description: courseDesc,
      active: courseActive
    };

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        if (isEditing && courseId) {
          const { error } = await supabase
            .from('courses')
            .update(courseData)
            .eq('id', courseId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('courses')
            .insert([courseData]);
          if (error) throw error;
        }
      } catch (err: any) {
        alert(`Supabase Error: ${err.message}`);
      }
    } else {
      saveLocalCourse({
        id: courseId,
        ...courseData
      });
    }

    // Reset Form
    setCourseId(undefined);
    setCourseName('');
    setCourseFee('');
    setCourseDesc('');
    setCourseActive(true);
    setIsEditing(false);
    
    fetchData();
    onUpdate();
  };

  const handleEditClick = (course: Course) => {
    setCourseId(course.id);
    setCourseCategoryId(course.category_id);
    setCourseName(course.name);
    setCourseFee(course.fee);
    setCourseDesc(course.description);
    setCourseActive(course.active);
    setIsEditing(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course from the catalog?')) return;

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase
          .from('courses')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        alert(`Supabase Error: ${err.message}`);
      }
    } else {
      deleteLocalCourse(id);
    }
    
    fetchData();
    onUpdate();
  };

  const cancelEdit = () => {
    setCourseId(undefined);
    setCourseName('');
    setCourseFee('');
    setCourseDesc('');
    setCourseActive(true);
    setIsEditing(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
      
      {/* Two columns layout for Configuration Forms */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Category Form */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} style={{ color: 'hsl(var(--primary))' }} />
            Add Offering Category
          </h3>
          
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Category Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Language Prep"
                value={catName}
                onChange={e => setCatName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '44px' }}>
              <Plus size={16} /> Add
            </button>
          </form>

          {/* Category List */}
          <div style={{ marginTop: '20px' }}>
            <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Existing Categories</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categories.map(c => (
                <span 
                  key={c.id} 
                  className="badge badge-tech" 
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    backgroundColor: c.name === 'Technologies' ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--accent) / 0.1)',
                    color: c.name === 'Technologies' ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
                    borderColor: c.name === 'Technologies' ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--accent) / 0.2)'
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Course Form */}
        <div className="glass-card">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
            {isEditing ? 'Edit Offering / Course' : 'Create Offering / Course'}
          </h3>

          <form onSubmit={handleSaveCourse} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select 
                className="form-select"
                value={courseCategoryId}
                onChange={e => setCourseCategoryId(e.target.value)}
                required
              >
                <option value="">Select a category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. NEET Biology Special"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tuition Fee</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="₹12,000/mo"
                  value={courseFee}
                  onChange={e => setCourseFee(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Brief Description</label>
              <textarea 
                className="form-input" 
                rows={2}
                placeholder="Topics covered, schedule options, and targets..."
                value={courseDesc}
                onChange={e => setCourseDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <input 
                type="checkbox" 
                id="courseActive" 
                checked={courseActive}
                onChange={e => setCourseActive(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="courseActive" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Course is active and open for enrollment
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                <Check size={16} /> {isEditing ? 'Update Course' : 'Create Course'}
              </button>
              {isEditing && (
                <button type="button" onClick={cancelEdit} className="btn btn-secondary">
                  <X size={16} /> Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Courses List Table */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Active Offerings Database</h3>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--muted))' }}>Loading table...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Category</th>
                  <th>Pricing / Fee</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(course => {
                  const cat = categories.find(c => c.id === course.category_id);
                  return (
                    <tr key={course.id}>
                      <td style={{ fontWeight: 600 }}>{course.name}</td>
                      <td>
                        <span className={`badge ${cat?.name === 'Technologies' ? 'badge-tech' : 'badge-academy'}`}>
                          {cat?.name || 'N/A'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'hsl(var(--primary))' }}>{course.fee}</td>
                      <td style={{ color: 'hsl(var(--muted))', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {course.description || '-'}
                      </td>
                      <td>
                        <span 
                          className="badge" 
                          style={{ 
                            backgroundColor: course.active ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--card-border))',
                            color: course.active ? 'hsl(var(--success))' : 'hsl(var(--muted))'
                          }}
                        >
                          {course.active ? 'Open' : 'Suspended'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleEditClick(course)} 
                          className="btn btn-ghost" 
                          style={{ padding: '6px' }}
                          title="Edit course"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(course.id)} 
                          className="btn btn-ghost" 
                          style={{ padding: '6px', color: 'hsl(var(--danger))' }}
                          title="Delete course"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--muted))' }}>
                      No courses found in database. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default ManageCourses;
