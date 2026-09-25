import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, X, Users, Check, UserPlus, Phone, MapPin, Briefcase, Hash, Search, Mail, CreditCard, FileText, Upload, FileCheck, ClipboardList, Calendar, Lock, Eye, EyeOff } from 'lucide-react';
import {
  getLocalEmployees,
  saveLocalEmployee,
  updateLocalEmployee,
  deleteLocalEmployee,
  saveLocalEmployeeTask,
  syncEmployeesWithSupabase,
  saveEmployeeCredential,
  getEmployeePassword,
  type Employee
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { sendTaskEmail } from '../lib/emailService';

interface EmployeesProps {
  isDemo: boolean;
}

// Avatar color palette based on first letter
const AVATAR_COLORS = [
  { bg: 'hsl(250 85% 65% / 0.15)', color: 'hsl(250 85% 65%)' },
  { bg: 'hsl(320 85% 60% / 0.15)', color: 'hsl(320 85% 60%)' },
  { bg: 'hsl(142 70% 45% / 0.15)', color: 'hsl(142 70% 45%)' },
  { bg: 'hsl(38 92% 50% / 0.15)', color: 'hsl(38 92% 50%)' },
  { bg: 'hsl(200 80% 55% / 0.15)', color: 'hsl(200 80% 55%)' },
  { bg: 'hsl(280 75% 60% / 0.15)', color: 'hsl(280 75% 60%)' },
];

const getAvatarColor = (name: string) => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const Employees: React.FC<EmployeesProps> = ({ isDemo }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [aadharNumber, setAadharNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadharDocUrl, setAadharDocUrl] = useState('');
  const [panDocUrl, setPanDocUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Validation errors
  const [contactError, setContactError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [aadharError, setAadharError] = useState('');
  const [panError, setPanError] = useState('');

  // File refs
  const aadharFileRef = useRef<HTMLInputElement>(null);
  const panFileRef = useRef<HTMLInputElement>(null);

  // Assign Task Modal State
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          syncEmployeesWithSupabase(data as Employee[]);
          setEmployees(data as Employee[]);
        } else {
          console.error('Supabase fetch failed, using local:', error);
          setEmployees(getLocalEmployees());
        }
      } catch (err) {
        console.error(err);
        setEmployees(getLocalEmployees());
      }
    } else {
      setEmployees(getLocalEmployees());
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, [isDemo]);

  const resetForm = () => {
    setEditingId(undefined);
    setName(''); setAge(''); setRole(''); setAddress('');
    setContactNumber(''); setEmail(''); setPassword(''); setAadharNumber(''); setPanNumber('');
    setAadharFile(null); setPanFile(null);
    setAadharDocUrl(''); setPanDocUrl('');
    setContactError(''); setEmailError(''); setAadharError(''); setPanError('');
    setIsEditing(false);
    if (aadharFileRef.current) aadharFileRef.current.value = '';
    if (panFileRef.current) panFileRef.current.value = '';
  };

  // Upload a file to Supabase Storage and return its public URL
  const uploadToStorage = async (file: File, folder: string): Promise<string> => {
    if (!supabase) throw new Error('Supabase not configured');
    const safeName = name.replace(/\s+/g, '_').toLowerCase();
    const path = `${safeName}_${Date.now()}/${folder}/${file.name}`;
    const { error } = await supabase.storage
      .from('employee-docs')
      .upload(path, file, { upsert: true, cacheControl: '3600' });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase.storage.from('employee-docs').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!name.trim() || !role.trim() || !contactNumber.trim()) {
      alert('Please fill out Name, Role, and Contact Number.');
      return;
    }
    if (contactNumber.length !== 10) {
      setContactError('Contact number must be exactly 10 digits.');
      hasError = true;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      hasError = true;
    }
    if (aadharNumber && !/^\d{12}$/.test(aadharNumber)) {
      setAadharError('Aadhar must be exactly 12 digits.');
      hasError = true;
    }
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
      setPanError('PAN format must be ABCDE1234F (5 letters, 4 digits, 1 letter).');
      hasError = true;
    }
    if (hasError) return;

    setContactError(''); setEmailError(''); setAadharError(''); setPanError('');

    // Upload documents to Supabase Storage if new files are selected
    let finalAadharUrl = aadharDocUrl;
    let finalPanUrl = panDocUrl;

    if (!isDemo && isSupabaseConfigured() && supabase) {
      setIsUploading(true);
      try {
        if (aadharFile) finalAadharUrl = await uploadToStorage(aadharFile, 'aadhar');
        if (panFile) finalPanUrl = await uploadToStorage(panFile, 'pan');
      } catch (err: any) {
        alert(`Document Upload Error: ${err.message}\n\nMake sure the 'employee-docs' bucket exists in Supabase Storage.`);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const supabasePayload = {
      name: name.trim(),
      age: age ? String(age).trim() : null,
      role: role.trim(),
      address: address ? address.trim() : null,
      contact_number: contactNumber.trim(),
      email: email ? email.trim().toLowerCase() : null,
      aadhar_number: aadharNumber ? aadharNumber.trim() : null,
      pan_number: panNumber ? panNumber.trim().toUpperCase() : null,
      aadhar_doc_url: finalAadharUrl || null,
      pan_doc_url: finalPanUrl || null
    };

    if (password && password.trim()) {
      if (editingId) saveEmployeeCredential(editingId, password.trim());
      if (email) saveEmployeeCredential(email.trim().toLowerCase(), password.trim());
    }

    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        if (isEditing && editingId) {
          const { error } = await supabase.from('employees').update(supabasePayload).eq('id', editingId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('employees').insert([supabasePayload]).select();
          if (error) throw error;
          if (data && data[0] && password && password.trim()) {
            saveEmployeeCredential(data[0].id, password.trim());
          }
        }
        await fetchEmployees();
      } catch (err: any) {
        alert(`Database Error: ${err.message || err}\n\nMake sure the "employees" table exists in your Supabase project.`);
        return;
      }
    } else {
      const localData = {
        ...supabasePayload,
        username: email ? email.split('@')[0] : name.toLowerCase().replace(/\s+/g, ''),
        password: password || 'password123'
      };
      if (isEditing && editingId) {
        const updated = updateLocalEmployee(editingId, localData as any);
        setEmployees(employees.map(e => e.id === editingId ? updated : e));
      } else {
        const newEmp = saveLocalEmployee(localData as any);
        setEmployees([newEmp, ...employees]);
      }
    }
    resetForm();
  };

  const handleEditClick = (emp: Employee) => {
    setEditingId(emp.id);
    setName(emp.name);
    setAge(emp.age ?? '');
    setRole(emp.role);
    setAddress(emp.address ?? '');
    setContactNumber(emp.contact_number || '');
    setEmail(emp.email ?? '');
    setPassword(getEmployeePassword(emp) || '');
    setAadharNumber(emp.aadhar_number ?? '');
    setPanNumber(emp.pan_number ?? '');
    setAadharDocUrl(emp.aadhar_doc_url ?? '');
    setPanDocUrl(emp.pan_doc_url ?? '');
    setAadharFile(null); setPanFile(null);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this employee?')) return;
    if (!isDemo && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        await fetchEmployees();
      } catch (err: any) {
        alert(`Delete Error: ${err.message || err}`);
      }
    } else {
      deleteLocalEmployee(id);
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const filtered = employees.filter(emp => {
    const q = searchTerm.toLowerCase();
    return !q ||
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      (emp.contact_number && emp.contact_number.includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q));
  });

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEmployee) return;

    setIsAssigning(true);
    try {
      const taskData = {
        employee_id: assigningEmployee.id,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        priority: taskPriority,
        due_date: taskDueDate,
        assigned_by: 'Admin',
        status: 'Pending'
      };

      // Automatically save to Supabase or local database
      if (!isDemo && isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('employee_tasks').insert([taskData]);
        if (error) {
          console.warn('Supabase task insert warning, saving locally:', error);
          saveLocalEmployeeTask(taskData as any);
        }
      } else {
        saveLocalEmployeeTask(taskData as any);
      }

      // Automatically dispatch email in background without blocking or showing popup
      if (assigningEmployee.email) {
        sendTaskEmail(
          assigningEmployee.email,
          assigningEmployee.name,
          taskTitle.trim(),
          taskDesc.trim(),
          taskDueDate,
          taskPriority,
          'Admin'
        ).catch(err => {
          console.warn('Background task email status:', err);
        });
      }

      const assignedEmpName = assigningEmployee.name;

      // Close modal and reset fields immediately
      setAssigningEmployee(null);
      setTaskTitle('');
      setTaskDesc('');
      setTaskPriority('Medium');
      setTaskDueDate('');

      // Show smooth auto-dismissing toast notification
      setToastMsg(`Task assigned to ${assignedEmpName} successfully!`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error: any) {
      console.error('Error assigning task:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fade-in 0.4s ease-out' }}>

      {/* ── Header ── */}
      <div className="glass-card" style={{ padding: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="brand-icon" style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={26} />
          </div>
          <div>
            <h2 style={{
              fontSize: '1.7rem', fontWeight: 800,
              background: 'linear-gradient(135deg, hsl(var(--foreground)) 50%, hsl(var(--primary)))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '4px'
            }}>
              Employee Directory
            </h2>
            <p style={{ color: 'hsl(var(--muted))', fontSize: '14px' }}>
              {employees.length} {employees.length === 1 ? 'member' : 'members'} · Training & IT Services
            </p>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '10px 18px', borderRadius: '12px', background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'hsl(var(--primary))' }}>{employees.length}</div>
            <div style={{ fontSize: '11px', color: 'hsl(var(--muted))', fontWeight: 600 }}>Total Staff</div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: Form + List ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Form Card ── */}
        <div className="glass-card" style={{ padding: '28px', position: 'sticky', top: '20px' }}>
          {/* Form header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid hsl(var(--card-border))' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: isEditing ? 'hsl(var(--warning) / 0.15)' : 'hsl(var(--primary) / 0.12)',
              color: isEditing ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isEditing ? <Edit2 size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                {isEditing ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted))' }}>
                {isEditing ? 'Update staff details below' : 'Fill in the details to register'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Name */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Users size={12} /> Full Name <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="e.g. Rajesh Kumar"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            {/* Age + Role row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Hash size={12} /> Age
                </label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. 28"
                  value={age}
                  min={1}
                  max={100}
                  step={1}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') { setAge(''); return; }
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num > 0) setAge(String(num));
                  }}
                  onKeyDown={e => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault();
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Briefcase size={12} /> Role <span style={{ color: 'hsl(var(--danger))' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Trainer"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Contact Number */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Phone size={12} /> Contact Number <span style={{ color: 'hsl(var(--danger))' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  className="form-input"
                  style={{
                    width: '100%',
                    borderColor: contactError ? 'hsl(var(--danger))' : contactNumber.length === 10 ? 'hsl(var(--success))' : undefined,
                    paddingRight: '52px'
                  }}
                  placeholder="9876543210"
                  value={contactNumber}
                  maxLength={10}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setContactNumber(digits);
                    if (digits.length > 0 && digits.length < 10) {
                      setContactError(`${10 - digits.length} more digit${10 - digits.length > 1 ? 's' : ''} needed`);
                    } else {
                      setContactError('');
                    }
                  }}
                  onKeyDown={e => {
                    if (!/^\d$/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  required
                />
                {/* Digit counter */}
                <span style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '11px', fontWeight: 700,
                  color: contactNumber.length === 10 ? 'hsl(var(--success))' : contactError ? 'hsl(var(--danger))' : 'hsl(var(--muted))'
                }}>
                  {contactNumber.length}/10
                </span>
              </div>
              {contactError && (
                <span style={{ fontSize: '12px', color: 'hsl(var(--danger))', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠ {contactError}
                </span>
              )}
            </div>

            {/* Address */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <MapPin size={12} /> Address
              </label>
              <textarea
                className="form-input"
                style={{ width: '100%', resize: 'vertical', minHeight: '72px', fontFamily: 'inherit', fontSize: '14px' }}
                placeholder="e.g. 12, Gandhi Street, Chennai - 600001"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            {/* ── Identity & Documents Section ── */}
            <div style={{ borderTop: '1px solid hsl(var(--card-border))', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--muted))', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <CreditCard size={12} /> Identity &amp; Documents
              </p>

              {/* Email */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Mail size={12} /> Email ID
                </label>
                <input
                  type="email"
                  className="form-input"
                  style={{ width: '100%', borderColor: emailError ? 'hsl(var(--danger))' : email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'hsl(var(--success))' : undefined }}
                  placeholder="e.g. rajesh@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                />
                {emailError && <span style={{ fontSize: '12px', color: 'hsl(var(--danger))', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>⚠ {emailError}</span>}
              </div>

              {/* Portal Password */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Lock size={12} /> Portal Password (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ width: '100%', paddingRight: '40px' }}
                    placeholder="Set employee login password (default: password123)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: showPassword ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease'
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Aadhar Number */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <CreditCard size={12} /> Aadhar Number
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', letterSpacing: '0.1em', borderColor: aadharError ? 'hsl(var(--danger))' : aadharNumber.length === 12 ? 'hsl(var(--success))' : undefined, paddingRight: '52px' }}
                    placeholder="12-digit Aadhar number"
                    value={aadharNumber}
                    maxLength={12}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setAadharNumber(digits);
                      setAadharError(digits.length > 0 && digits.length < 12 ? `${12 - digits.length} more digits needed` : '');
                    }}
                    onKeyDown={e => {
                      if (!/^\d$/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) e.preventDefault();
                    }}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: 700, color: aadharNumber.length === 12 ? 'hsl(var(--success))' : aadharError ? 'hsl(var(--danger))' : 'hsl(var(--muted))' }}>
                    {aadharNumber.length}/12
                  </span>
                </div>
                {aadharError && <span style={{ fontSize: '12px', color: 'hsl(var(--danger))', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>⚠ {aadharError}</span>}
                {/* Aadhar doc upload */}
                <div
                  style={{ marginTop: '8px', border: `1.5px dashed ${aadharFile || aadharDocUrl ? 'hsl(var(--success))' : 'hsl(var(--card-border))'}`, borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'hsl(var(--background))' }}
                  onClick={() => aadharFileRef.current?.click()}
                >
                  {(aadharFile || aadharDocUrl) ? <FileCheck size={16} style={{ color: 'hsl(var(--success))' }} /> : <Upload size={16} style={{ color: 'hsl(var(--muted))' }} />}
                  <span style={{ fontSize: '12px', color: (aadharFile || aadharDocUrl) ? 'hsl(var(--success))' : 'hsl(var(--muted))', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {aadharFile ? aadharFile.name : aadharDocUrl ? 'Document uploaded ✓' : 'Upload Aadhar Document (PDF / Image)'}
                  </span>
                  {(aadharFile || aadharDocUrl) && (
                    <button type="button" onClick={e => { e.stopPropagation(); setAadharFile(null); setAadharDocUrl(''); if (aadharFileRef.current) aadharFileRef.current.value = ''; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted))', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input ref={aadharFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { setAadharFile(e.target.files[0]); setAadharDocUrl(''); }}} />
              </div>

              {/* PAN Number */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <FileText size={12} /> PAN Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', textTransform: 'uppercase', letterSpacing: '0.1em', borderColor: panError ? 'hsl(var(--danger))' : panNumber.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase()) ? 'hsl(var(--success))' : undefined }}
                  placeholder="e.g. ABCDE1234F"
                  value={panNumber}
                  maxLength={10}
                  onChange={e => { setPanNumber(e.target.value.toUpperCase()); setPanError(''); }}
                />
                {panError && <span style={{ fontSize: '12px', color: 'hsl(var(--danger))', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>⚠ {panError}</span>}
                <p style={{ fontSize: '11px', color: 'hsl(var(--muted))', marginTop: '4px' }}>Format: 5 letters + 4 digits + 1 letter (ABCDE1234F)</p>
                {/* PAN doc upload */}
                <div
                  style={{ marginTop: '8px', border: `1.5px dashed ${panFile || panDocUrl ? 'hsl(var(--success))' : 'hsl(var(--card-border))'}`, borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'hsl(var(--background))' }}
                  onClick={() => panFileRef.current?.click()}
                >
                  {(panFile || panDocUrl) ? <FileCheck size={16} style={{ color: 'hsl(var(--success))' }} /> : <Upload size={16} style={{ color: 'hsl(var(--muted))' }} />}
                  <span style={{ fontSize: '12px', color: (panFile || panDocUrl) ? 'hsl(var(--success))' : 'hsl(var(--muted))', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {panFile ? panFile.name : panDocUrl ? 'Document uploaded ✓' : 'Upload PAN Card Document (PDF / Image)'}
                  </span>
                  {(panFile || panDocUrl) && (
                    <button type="button" onClick={e => { e.stopPropagation(); setPanFile(null); setPanDocUrl(''); if (panFileRef.current) panFileRef.current.value = ''; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted))', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input ref={panFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { setPanFile(e.target.files[0]); setPanDocUrl(''); }}} />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, gap: '8px', justifyContent: 'center' }} disabled={isUploading}>
                <Check size={16} /> {isUploading ? 'Uploading Documents...' : isEditing ? 'Update Employee' : 'Add Employee'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ gap: '6px' }}>
                  <X size={16} /> Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── Employee Cards / List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Search bar */}
          <div className="glass-card" style={{ padding: '14px 18px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by name, role or number..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px', width: '100%', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'hsl(var(--muted))' }}>
              <div style={{ fontSize: '14px' }}>Loading employees...</div>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="glass-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'hsl(var(--card-border))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'hsl(var(--muted))' }}>
                <Users size={36} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '16px', color: 'hsl(var(--foreground))', marginBottom: '6px' }}>
                {searchTerm ? 'No results found' : 'No employees yet'}
              </p>
              <p style={{ fontSize: '13px', color: 'hsl(var(--muted))' }}>
                {searchTerm ? 'Try a different search term.' : 'Use the form to add your first team member.'}
              </p>
            </div>
          ) : (
            filtered.map(emp => {
              const avatar = getAvatarColor(emp.name);
              return (
                <div
                  key={emp.id}
                  className="glass-card"
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    borderLeft: `4px solid ${avatar.color}`,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                    background: avatar.bg, color: avatar.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '20px'
                  }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: 'hsl(var(--foreground))' }}>{emp.name}</span>
                      {emp.age && (
                        <span style={{ fontSize: '12px', color: 'hsl(var(--muted))', background: 'hsl(var(--card-border))', padding: '2px 8px', borderRadius: '6px' }}>
                          Age {emp.age}
                        </span>
                      )}
                      <span style={{ background: avatar.bg, color: avatar.color, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                        {emp.role}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'hsl(var(--muted))' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={13} /> {emp.contact_number}
                      </span>
                      {emp.address && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={13} />
                          <span style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {emp.address}
                          </span>
                        </span>
                      )}
                      {emp.email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Mail size={13} /> {emp.email}
                        </span>
                      )}
                    </div>
                    {/* Document download links */}
                    {(emp.aadhar_doc_url || emp.pan_doc_url) && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {emp.aadhar_doc_url && (
                          <a href={emp.aadhar_doc_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.08)', padding: '3px 10px', borderRadius: '6px', textDecoration: 'none' }}>
                            <FileCheck size={12} /> Aadhar Doc
                          </a>
                        )}
                        {emp.pan_doc_url && (
                          <a href={emp.pan_doc_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'hsl(var(--success))', background: 'hsl(var(--success) / 0.08)', padding: '3px 10px', borderRadius: '6px', textDecoration: 'none' }}>
                            <FileCheck size={12} /> PAN Doc
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => setAssigningEmployee(emp)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '13px', height: '36px', gap: '6px' }}
                    >
                      <ClipboardList size={14} /> Assign Task
                    </button>
                    <button
                      onClick={() => handleEditClick(emp)}
                      className="btn btn-ghost btn-icon"
                      style={{ width: '36px', height: '36px', color: 'hsl(var(--primary))' }}
                      title="Edit employee"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(emp.id)}
                      className="btn btn-ghost btn-icon"
                      style={{ width: '36px', height: '36px', color: 'hsl(var(--danger))' }}
                      title="Remove employee"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Assign Task Modal ── */}
      {assigningEmployee && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          animation: 'fade-in 0.2s ease-out'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '32px', margin: '20px', position: 'relative' }}>
            <button
              onClick={() => setAssigningEmployee(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted))' }}
            >
              <X size={20} />
            </button>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList size={22} style={{ color: 'hsl(var(--primary))' }} /> Assign Task
            </h3>
            <p style={{ fontSize: '14px', color: 'hsl(var(--muted))', marginBottom: '24px' }}>
              Assigning to <strong style={{ color: 'hsl(var(--foreground))' }}>{assigningEmployee.name}</strong>
            </p>

            <form onSubmit={handleAssignTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Task Title <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g. Update client presentation"
                  required
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  placeholder="Provide more details..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Due Date <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
                    <input
                      type="date"
                      className="form-input"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      style={{ paddingLeft: '36px' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isAssigning}>
                  {isAssigning ? 'Saving...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Auto-Dismiss Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 9999,
          animation: 'fade-in 0.25s ease-out'
        }}>
          <Check size={18} />
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Employees;
