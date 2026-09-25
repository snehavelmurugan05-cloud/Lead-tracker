import React, { useEffect, useState } from 'react';

interface StaggeredTextProps {
  text: string;
  /** Delay between each character in ms (default 60) */
  staggerMs?: number;
  /** Initial delay before animation starts in ms (default 100) */
  initialDelayMs?: number;
  style?: React.CSSProperties;
  className?: string;
}

const StaggeredText: React.FC<StaggeredTextProps> = ({
  text,
  staggerMs = 60,
  initialDelayMs = 100,
  style,
  className,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Tiny delay so the keyframe animation fires after mount
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const chars = text.split('');

  return (
    <>
      <style>{`
        @keyframes stagger-in {
          0%   { opacity: 0; transform: translateY(18px); filter: blur(4px); }
          60%  { opacity: 1; filter: blur(0px); }
          100% { opacity: 1; transform: translateY(0px); filter: blur(0px); }
        }
      `}</style>
      <span
        className={className}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          ...style,
        }}
        aria-label={text}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              opacity: 0,
              animation: mounted
                ? `stagger-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards`
                : 'none',
              animationDelay: mounted
                ? `${initialDelayMs + i * staggerMs}ms`
                : '0ms',
              // preserve spaces
              whiteSpace: char === ' ' ? 'pre' : 'normal',
            }}
          >
            {char}
          </span>
        ))}
      </span>
    </>
  );
};

export default StaggeredText;
