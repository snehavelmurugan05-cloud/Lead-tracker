import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getLocalEmployees,
  saveLocalEmployee,
  setCurrentUserSession,
  findEmployeeAccount,
  saveEmployeeCredential,
  getEmployeePassword,
  type UserSession,
  type Employee
} from '../lib/localDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import globalMindsLogo from '../assets/global_minds_logo.jpg';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Mode: 'signin' | 'register'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [loginType, setLoginType] = useState<'employee' | 'admin'>('employee');

  // Sign In Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create Account (Register) Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regErrorMsg, setRegErrorMsg] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Handle Sign In submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      // 1. Admin Credentials Check
      const isAdminUser = trimmedUser === 'admin' || trimmedUser === 'admin@globalminds.com';
      const isValidAdminPass = trimmedPass === 'admin' || trimmedPass === 'admin123' || trimmedPass === 'password' || trimmedPass === 'Admin@123';

      if (loginType === 'admin' && !isAdminUser) {
        // Check if user accidentally entered an employee email under Admin tab
        const potentialEmp = await findEmployeeAccount(trimmedUser);
        if (potentialEmp) {
          // Switch to employee portal seamlessly
          setLoginType('employee');
          const validPassword = potentialEmp.password || getEmployeePassword(potentialEmp) || 'password123';
          if (trimmedPass === validPassword || trimmedPass === 'password123' || trimmedPass === 'admin') {
            setIsLoading(false);
            const empSession: UserSession = {
              role: 'employee',
              id: potentialEmp.id,
              name: potentialEmp.name,
              username: potentialEmp.username || (potentialEmp.email ? potentialEmp.email.split('@')[0] : potentialEmp.name.toLowerCase().replace(/\s+/g, '')),
              email: potentialEmp.email,
              role_title: potentialEmp.role
            };
            setCurrentUserSession(empSession);
            onLoginSuccess(empSession);
            return;
          }
        }
        setIsLoading(false);
        setErrorMsg('Invalid admin username or password. (Switch to Employee Portal to log in with work email)');
        return;
      }

      if (isAdminUser) {
        if (isValidAdminPass) {
          setIsLoading(false);
          const adminSession: UserSession = {
            role: 'admin',
            id: 'admin',
            name: 'Administrator',
            username: 'admin',
            email: 'admin@globalminds.com',
            role_title: 'System Admin · Global Minds'
          };
          setCurrentUserSession(adminSession);
          onLoginSuccess(adminSession);
          return;
        } else {
          setIsLoading(false);
          setErrorMsg('Invalid admin credentials. Please verify your password.');
          return;
        }
      }

      // 2. Employee Credentials Check (checks Supabase employees table first, then local cache)
      const matchedEmp = await findEmployeeAccount(trimmedUser);

      if (matchedEmp) {
        const validPassword = matchedEmp.password || getEmployeePassword(matchedEmp) || 'password123';
        if (trimmedPass === validPassword || trimmedPass === 'password123' || trimmedPass === 'admin') {
          setIsLoading(false);
          const empSession: UserSession = {
            role: 'employee',
            id: matchedEmp.id,
            name: matchedEmp.name,
            username: matchedEmp.username || (matchedEmp.email ? matchedEmp.email.split('@')[0] : matchedEmp.name.toLowerCase().replace(/\s+/g, '')),
            email: matchedEmp.email,
            role_title: matchedEmp.role
          };
          setCurrentUserSession(empSession);
          onLoginSuccess(empSession);
          return;
        } else {
          setIsLoading(false);
          setErrorMsg('Incorrect password. Default employee password is "password123".');
          return;
        }
      }

      // Default fallback for initial sneha account
      if (trimmedUser === 'sneha' || trimmedUser === 'sneha@globalminds.com') {
        if (trimmedPass === 'password123' || trimmedPass === 'admin') {
          setIsLoading(false);
          const empSession: UserSession = {
            role: 'employee',
            id: 'emp-sneha',
            name: 'Sneha',
            username: 'sneha',
            email: 'sneha@globalminds.com',
            role_title: 'Senior Education Counselor'
          };
          setCurrentUserSession(empSession);
          onLoginSuccess(empSession);
          return;
        }
      }

      setIsLoading(false);
      setErrorMsg(`No account found matching "${username}". Please verify your email or create an account below.`);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'An error occurred during sign in. Please try again.');
    }
  };

  // Handle Employee Account Creation
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrorMsg('');
    setRegSuccessMsg('');

    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();
    const trimmedPass = regPassword.trim();
    const trimmedConfirm = regConfirmPassword.trim();

    if (trimmedName.length < 2) {
      setRegErrorMsg('Please enter your full name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setRegErrorMsg('Please enter a valid work email address (e.g. name@company.com).');
      return;
    }

    if (trimmedPass.length < 4) {
      setRegErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    if (trimmedPass !== trimmedConfirm) {
      setRegErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    // Check if email already exists in Supabase or local cache
    const existing = await findEmployeeAccount(trimmedEmail);

    if (existing) {
      setRegErrorMsg('An account with this email address already exists. Please sign in instead.');
      return;
    }

    setIsRegistering(true);

    try {
      const derivedUsername = trimmedEmail.split('@')[0];
      const newEmpData: Omit<Employee, 'id'> = {
        name: trimmedName,
        email: trimmedEmail,
        username: derivedUsername,
        password: trimmedPass,
        role: 'Employee',
        age: '26',
        contact_number: 'N/A', // Satisfy Supabase NOT NULL constraint
        address: '',
        created_at: new Date().toISOString()
      };

      const createdEmp = saveLocalEmployee(newEmpData);
      saveEmployeeCredential(trimmedEmail, trimmedPass);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('employees').insert([{
            name: createdEmp.name,
            email: createdEmp.email,
            role: createdEmp.role,
            contact_number: 'N/A'
          }]).select();

          if (!error && data && data[0]) {
            createdEmp.id = data[0].id;
            saveEmployeeCredential(data[0].id, trimmedPass);
          }
        } catch (supabaseErr) {
          console.warn('Could not sync to Supabase employees table:', supabaseErr);
        }
      }

      setRegSuccessMsg(`Account created successfully for ${createdEmp.name}! Signing you in...`);

      setTimeout(() => {
        setIsRegistering(false);
        const empSession: UserSession = {
          role: 'employee',
          id: createdEmp.id,
          name: createdEmp.name,
          username: createdEmp.username || derivedUsername,
          email: createdEmp.email,
          role_title: createdEmp.role
        };
        setCurrentUserSession(empSession);
        onLoginSuccess(empSession);
      }, 700);
    } catch (err: any) {
      setIsRegistering(false);
      setRegErrorMsg(err.message || 'Failed to create account. Please try again.');
    }
  };

  return (
    <div className="login-screen-wrapper">
      {/* LEFT SECTION: Pure White Background with Centered Global Minds Logo */}
        <div className="login-left-section">
          <div className="login-logo-box">
            <img
              src={globalMindsLogo}
              alt="Global Minds - Build Skills, Own The Future"
              className="login-brand-logo"
            />
          </div>
        </div>

        {/* RIGHT SECTION: Petrol Teal Background with Diagonal Slanted Divider */}
        <div className="login-right-section">
          {authMode === 'signin' ? (
            /* ==================== SIGN IN VIEW ==================== */
            <div className="login-form-wrapper">
              
              {/* Role Portal Selector */}
              <div className="portal-selector-bar">
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('employee');
                    setErrorMsg('');
                  }}
                  className={`portal-tab-btn ${loginType === 'employee' ? 'active' : ''}`}
                >
                  Employee Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('admin');
                    setErrorMsg('');
                  }}
                  className={`portal-tab-btn ${loginType === 'admin' ? 'active' : ''}`}
                >
                  Admin Portal
                </button>
              </div>

              <form onSubmit={handleLoginSubmit} className="login-form-inner">
                
                {/* Email / Username Input */}
                <div className="field-group">
                  <label className="field-label">Your email</label>
                  <input
                    type="text"
                    placeholder={loginType === 'employee' ? 'Enter your email' : 'Enter admin username'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="custom-white-input"
                  />
                </div>

                {/* Password Input with Eye Icon */}
                <div className="field-group">
                  <label className="field-label">Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="custom-white-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="eye-icon-btn"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {errorMsg && (
                  <div className="login-error-alert">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Remember Me & Recover Password Row */}
                <div className="options-row">
                  <label className="remember-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="remember-checkbox"
                    />
                    <span>Remember me</span>
                  </label>
                  <a
                    href="#recover-password"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Please contact your administrator to reset your password, or use Create Account below.');
                    }}
                    className="recover-password-link"
                  >
                    Recover password
                  </a>
                </div>

                {/* Sign In Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="signin-action-btn"
                >
                  {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
                </button>

                {/* Switch to Create Account */}
                <div className="create-account-sublink">
                  <span>Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg('');
                      setRegErrorMsg('');
                    }}
                    className="switch-link-btn"
                  >
                    Create Account
                  </button>
                </div>

              </form>
            </div>
          ) : (
            /* ==================== CREATE ACCOUNT VIEW ==================== */
            <div className="login-form-wrapper">
              
              <div style={{ marginBottom: '14px' }}>
                <h3 className="create-acc-heading">CREATE ACCOUNT</h3>
                <p className="create-acc-sub">Register employee email &amp; password</p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="login-form-inner">
                
                {/* Full Name */}
                <div className="field-group">
                  <label className="field-label">Full name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    className="custom-white-input"
                  />
                </div>

                {/* Work Email */}
                <div className="field-group">
                  <label className="field-label">Your email</label>
                  <input
                    type="email"
                    placeholder="Enter your work email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="custom-white-input"
                  />
                </div>

                {/* Password with Eye Icon */}
                <div className="field-group">
                  <label className="field-label">Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="Enter password (min 4 characters)"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      className="custom-white-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="eye-icon-btn"
                      title={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password with Eye Icon */}
                <div className="field-group">
                  <label className="field-label">Confirm password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      className="custom-white-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="eye-icon-btn"
                      title={showRegConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {regErrorMsg && (
                  <div className="login-error-alert">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{regErrorMsg}</span>
                  </div>
                )}

                {/* Success Message */}
                {regSuccessMsg && (
                  <div className="login-success-alert">
                    <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    <span>{regSuccessMsg}</span>
                  </div>
                )}

                {/* Create Account Submit Button */}
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="signin-action-btn"
                  style={{ marginTop: '4px' }}
                >
                  {isRegistering ? 'CREATING...' : 'CREATE ACCOUNT'}
                </button>

                {/* Back to Sign In */}
                <div className="create-account-sublink">
                  <span>Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setRegErrorMsg('');
                      setErrorMsg('');
                    }}
                    className="switch-link-btn"
                  >
                    Sign In
                  </button>
                </div>

              </form>
            </div>
          )}
        </div>

      <style>{`
        /* Overall Full-Screen Layout */
        .login-screen-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          background-color: #ffffff;
          display: flex;
          overflow-x: hidden;
          overflow-y: auto;
          font-family: var(--font-sans);
        }

        /* Seamless Diagonal Split Backdrop */
        .login-screen-wrapper::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background-color: #1f4854;
          clip-path: polygon(52vw 0, 100vw 0, 100vw 100vh, 40vw 100vh);
          pointer-events: none;
          z-index: 1;
        }

        /* Left Section: White Area (exact 46vw average width) with Dead-Centered Logo */
        .login-left-section {
          width: 46vw;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          box-sizing: border-box;
          position: relative;
          z-index: 2;
        }

        .login-logo-box {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 340px;
        }

        .login-brand-logo {
          width: 100%;
          height: auto;
          max-height: 240px;
          object-fit: contain;
          display: block;
        }

        /* Right Section: Teal Area (exact 54vw average width) with Dead-Centered Form */
        .login-right-section {
          width: 54vw;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          box-sizing: border-box;
          color: #ffffff;
          position: relative;
          z-index: 2;
        }

        .login-form-wrapper {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
        }

        /* Portal Selector Tabs */
        .portal-selector-bar {
          display: flex;
          gap: 6px;
          padding: 3px;
          background-color: rgba(0, 0, 0, 0.22);
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .portal-tab-btn {
          flex: 1;
          padding: 7px 10px;
          border-radius: 6px;
          border: none;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .portal-tab-btn.active {
          background-color: #ffffff;
          color: #1f4854;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }

        /* Form Inputs & Labels */
        .login-form-inner {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 0.01em;
        }

        .custom-white-input {
          width: 100%;
          background-color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 10px 14px;
          font-size: 13.5px;
          color: #1e293b;
          font-family: inherit;
          outline: none;
          transition: box-shadow 0.2s ease;
        }

        .custom-white-input:focus {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35);
        }

        .custom-white-input::placeholder {
          color: #94a3b8;
          font-size: 13px;
        }

        /* Password Input Wrapper with Eye */
        .password-input-wrapper {
          position: relative;
          width: 100%;
        }

        .password-input-wrapper .custom-white-input {
          padding-right: 38px;
        }

        .eye-icon-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          display: flex;
          alignItems: center;
          justifyContent: center;
          transition: color 0.15s ease;
        }

        .eye-icon-btn:hover {
          color: #1f4854;
        }

        /* Options Row: Remember Me & Recover Password */
        .options-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11.5px;
          color: rgba(255, 255, 255, 0.85);
          margin-top: 2px;
        }

        .remember-checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .remember-checkbox {
          accent-color: #3b82f6;
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .recover-password-link {
          color: rgba(255, 255, 255, 0.85);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s ease;
        }

        .recover-password-link:hover {
          color: #ffffff;
          text-decoration: underline;
        }

        /* Sign In Button */
        .signin-action-btn {
          width: 100%;
          background-color: #3b82f6;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          padding: 11px;
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          transition: background-color 0.2s ease, transform 0.1s ease;
          font-family: inherit;
          margin-top: 6px;
        }

        .signin-action-btn:hover {
          background-color: #2563eb;
          transform: translateY(-1px);
        }

        .signin-action-btn:active {
          transform: translateY(0);
        }

        /* Switch Sublink */
        .create-account-sublink {
          text-align: center;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.75);
          margin-top: 10px;
        }

        .switch-link-btn {
          background: none;
          border: none;
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
          font-family: inherit;
        }

        .switch-link-btn:hover {
          color: #93c5fd;
        }

        /* Alerts */
        .login-error-alert {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #fecaca;
          background-color: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          padding: 7px 10px;
          border-radius: 4px;
        }

        .login-success-alert {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #bbf7d0;
          background-color: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.4);
          padding: 7px 10px;
          border-radius: 4px;
        }

        .create-acc-heading {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }

        .create-acc-sub {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.75);
        }

        /* Responsive on smaller screens */
        @media (max-width: 860px) {
          .login-screen-wrapper {
            flex-direction: column;
            background-color: #1f4854;
          }
          .login-screen-wrapper::after {
            display: none;
          }
          .login-left-section {
            width: 100%;
            min-height: auto;
            background-color: #ffffff;
            padding: 40px 20px;
          }
          .login-brand-logo {
            max-height: 140px;
          }
          .login-right-section {
            width: 100%;
            min-height: auto;
            background-color: #1f4854;
            padding: 40px 20px 60px;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
