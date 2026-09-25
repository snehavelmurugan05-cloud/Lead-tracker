import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import type { TerminalLine } from '../lib/geminiSim';

interface TerminalLogProps {
  logs: TerminalLine[];
  onClear: () => void;
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ logs, onClear }) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: 'hsl(var(--muted))',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Terminal size={14} style={{ color: 'hsl(var(--primary))' }} />
          <span>AI Assistant Console Logs</span>
        </div>
        {logs.length > 0 && (
          <button 
            onClick={onClear} 
            className="btn btn-ghost" 
            style={{ 
              padding: '4px 8px', 
              fontSize: '11px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              color: 'hsl(var(--danger))'
            }}
          >
            <Trash2 size={12} />
            Clear Logs
          </button>
        )}
      </div>

      <div className="terminal-logger">
        {/* Terminal Window Header (Simulated macOS buttons) */}
        <div 
          style={{ 
            display: 'flex', 
            gap: '6px', 
            paddingBottom: '12px', 
            borderBottom: '1px solid #1a2233', 
            marginBottom: '8px' 
          }}
        >
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f56' }}></div>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffbd2e' }}></div>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27c93f' }}></div>
          <span style={{ fontSize: '11px', color: '#5a657a', marginLeft: '10px', fontFamily: 'var(--font-mono)' }}>gemini-agent-engine ~ bash</span>
        </div>

        {logs.length === 0 ? (
          <div style={{ color: '#5a657a', fontStyle: 'italic', padding: '8px 0' }}>
            Console idle. Submit a command above to begin tracking AI executions...
          </div>
        ) : (
          logs.map((line) => (
            <div key={line.id} className="terminal-line">
              <span className="timestamp">[{line.timestamp}]</span>
              <span className={`prefix ${line.prefix}`}>
                {line.prefix.toUpperCase()}:
              </span>
              <span className="content">{line.content}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
export default TerminalLog;
