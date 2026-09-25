import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Mail, Key, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { resetLocalDatabase } from '../lib/localDatabase';
import { getResendApiKey, setResendApiKey, sendTaskEmail } from '../lib/emailService';

interface SettingsProps {
  onDatabaseUpdate: () => void;
  isDemo: boolean;
  setIsDemo: (val: boolean) => void;
}

export const SettingsPage: React.FC<SettingsProps> = ({
  onDatabaseUpdate,
  isDemo,
  setIsDemo
}) => {
  const [apiKey, setApiKey] = useState<string>(getResendApiKey());
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [testEmail, setTestEmail] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleResetDatabase = () => {
    if (window.confirm('Are you sure you want to restore the simulation database to defaults? All custom enquiries and courses will be overwritten.')) {
      resetLocalDatabase();
      onDatabaseUpdate();
      alert('Local database successfully reset to default state.');
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setResendApiKey(apiKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestEmail = async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      alert('Please enter a valid email address to send a test message.');
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    const result = await sendTaskEmail(
      testEmail.trim(),
      'Valued Team Member',
      'Global Minds System Email Test',
      'This is an automated test message from your Global Minds management system to verify employee email notifications.',
      new Date().toISOString().split('T')[0],
      'High',
      'System Admin'
    );

    setIsTesting(false);
    if (result.success) {
      setTestStatus({ success: true, message: `Test email sent successfully to ${testEmail}!` });
    } else {
      setTestStatus({
        success: false,
        message: `Delivery failed: ${result.message}. (Note: Resend free tier on onboarding@resend.dev requires sending to your registered Resend account email or verifying your domain at resend.com/domains).`
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      
      {/* Simulation Toggle */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Execution Mode</h3>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted))' }}>
              Toggle between the Client-side AI Simulation and Live Supabase backend.
            </p>
          </div>
          <button 
            onClick={() => setIsDemo(!isDemo)} 
            className={`btn ${isDemo ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isDemo ? 'Switch to Supabase Live' : 'Switch to Local Simulation'}
          </button>
        </div>
      </div>

      {/* Employee Email & Notification Settings */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Mail size={18} style={{ color: 'hsl(var(--primary))' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Employee Email Notifications (Resend API)</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted))', marginBottom: '18px', lineHeight: '1.5' }}>
          When assigning tasks to employees with saved email addresses, the system notifies them automatically. You can update your Resend API key below or test delivery.
        </p>

        <form onSubmit={handleSaveApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--muted))', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Key size={12} /> Resend API Key
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="password"
                className="form-input"
                style={{ flex: 1, fontFamily: 'monospace' }}
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>
                {isSaved ? 'Saved!' : 'Save Key'}
              </button>
            </div>
            {isSaved && (
              <span style={{ fontSize: '12px', color: 'hsl(var(--success))', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Resend API Key updated successfully!
              </span>
            )}
          </div>
        </form>

        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--card-border))', margin: '20px 0' }} />

        {/* Test Email Section */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Send Test Notification</h4>
          <p style={{ fontSize: '12px', color: 'hsl(var(--muted))', marginBottom: '12px' }}>
            Verify your key by sending a test task notification to any employee email:
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="email"
              className="form-input"
              style={{ flex: 1 }}
              placeholder="e.g. employee@globalminds.com"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={isTesting}
              className="btn btn-secondary"
              style={{ minWidth: '130px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={14} /> {isTesting ? 'Sending...' : 'Send Test'}
            </button>
          </div>

          {testStatus && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              background: testStatus.success ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--danger) / 0.1)',
              border: `1px solid ${testStatus.success ? 'hsl(var(--success) / 0.3)' : 'hsl(var(--danger) / 0.3)'}`,
              color: testStatus.success ? 'hsl(var(--success))' : 'hsl(var(--danger))'
            }}>
              {testStatus.success ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Database Operations */}
      <div className="glass-card" style={{ border: '1px solid hsl(var(--danger) / 0.2)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--danger))' }}>
          <AlertTriangle size={18} />
          Danger Zone
        </h3>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted))', marginBottom: '16px' }}>
          Operations to manage the local database. These will clear your current entries and reset them to seed defaults.
        </p>
        <button 
          onClick={handleResetDatabase} 
          className="btn btn-danger"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RotateCcw size={16} />
          Reset Simulation Database
        </button>
      </div>

    </div>
  );
};
export default SettingsPage;
