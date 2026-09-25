import { useEffect, useRef } from 'react';

interface ThinkingDotsProps {
  /** Pixel gap between dots (default 28) */
  gap?: number;
  /** Base dot radius (default 1.8) */
  dotRadius?: number;
  /** Max extra radius added at cloud center (default 2.2) */
  radiusBoost?: number;
  /** Dot color (default 'rgba(255,255,255,…)') */
  color?: string;
  /** How wide the influence cloud is (default 180) */
  cloudRadius?: number;
  /** Cloud drift speed multiplier (default 1) */
  speed?: number;
  style?: React.CSSProperties;
}

const ThinkingDots: React.FC<ThinkingDotsProps> = ({
  gap = 28,
  dotRadius = 1.8,
  radiusBoost = 2.2,
  color = '255,255,255',
  cloudRadius = 190,
  speed = 1,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Cloud follows a Lissajous path so it drifts organically across the canvas
    const t0 = performance.now();
    const lissA = { x: 0.7, y: 0.5 };   // frequency ratio
    const lissP = { x: Math.PI / 3 };    // phase offset

    const draw = (now: number) => {
      const t = ((now - t0) / 1000) * speed;

      // Organic drifting center (Lissajous figure, stays within 20-80% of canvas)
      const cx = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(lissA.x * t + lissP.x)));
      const cy = H * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(lissA.y * t)));

      // Breathing phase — slow pulse so the whole cloud expands/contracts
      const breathe = 0.5 + 0.5 * Math.sin(t * 1.4);

      ctx.clearRect(0, 0, W, H);

      // Draw each dot in the grid
      for (let x = gap / 2; x < W; x += gap) {
        for (let y = gap / 2; y < H; y += gap) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Gaussian influence — falls off smoothly with distance
          const influence = Math.exp(-(dist * dist) / (2 * cloudRadius * cloudRadius));

          // Combine distance-based influence with the global breathe pulse
          const opacity = 0.08 + influence * (0.55 + 0.25 * breathe);
          const r       = dotRadius + influence * radiusBoost * (0.8 + 0.2 * breathe);

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color},${Math.min(opacity, 1).toFixed(3)})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [gap, dotRadius, radiusBoost, color, cloudRadius, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
};

export default ThinkingDots;
