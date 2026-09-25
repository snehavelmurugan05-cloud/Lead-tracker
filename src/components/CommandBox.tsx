import React, { useState, useEffect } from 'react';
import { Send, Mic, MicOff, AlertCircle } from 'lucide-react';

interface CommandBoxProps {
  onSubmit: (command: string) => void;
  isLoading: boolean;
  lastReply: string | null;
  lastReplySuccess: boolean;
}

export const CommandBox: React.FC<CommandBoxProps> = ({
  onSubmit,
  isLoading,
  lastReply,
  lastReplySuccess
}) => {
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCommand(transcript);
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const handleVoiceToggle = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Try Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isLoading) return;
    onSubmit(command);
    setCommand('');
  };

  return (
    <div className="command-panel">
      <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="command-input-container">
          <div className="command-input-icon">
            <Send size={18} />
          </div>
          
          <input
            type="text"
            className="command-input"
            placeholder={isListening ? "Listening... Speak now." : "Type plain-English commands (e.g. 'Add enquiry for Ashok...')..."}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={isLoading}
          />
          
          {/* Voice Command Button */}
          <button
            type="button"
            className={`command-voice-btn ${isListening ? 'listening' : ''}`}
            onClick={handleVoiceToggle}
            title={isListening ? "Stop listening" : "Start voice input"}
            disabled={isLoading}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          
          {/* Submit Button */}
          <button
            type="submit"
            className="command-submit-btn"
            disabled={isLoading || !command.trim()}
          >
            <span>{isLoading ? 'Processing...' : 'Send'}</span>
          </button>
        </div>
      </form>

      {/* Response Box */}
      {lastReply && (
        <div 
          style={{ 
            marginTop: '8px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: lastReplySuccess ? 'hsl(var(--success) / 0.08)' : 'hsl(var(--danger) / 0.08)',
            border: `1px solid ${lastReplySuccess ? 'hsl(var(--success) / 0.2)' : 'hsl(var(--danger) / 0.2)'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '14px',
            lineHeight: 1.4,
            color: lastReplySuccess ? 'hsl(var(--success))' : 'hsl(var(--danger))'
          }}
        >
          <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 'bold', display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Assistant Response
            </span>
            <span style={{ whiteSpace: 'pre-line' }}>{lastReply}</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default CommandBox;
