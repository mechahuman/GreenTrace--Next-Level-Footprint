import { useEffect, useRef } from 'react';

const COLORS = [
  [168, 85, 247],   // purple-500
  [192, 132, 252],  // purple-400
  [139, 92, 246],   // violet-500
  [216, 180, 254],  // purple-200
];

const SPAWN_PER_MOVE = 2;    // subtle — very few per event
const MAX_PARTICLES  = 120;  // hard cap

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

export default function ParticleCanvas() {
  const canvasRef  = useRef(null);
  const particles  = useRef([]);
  const mouseRef   = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnAt = (mx, my) => {
      for (let i = 0; i < SPAWN_PER_MOVE; i++) {
        const [r, g, b] = pick(COLORS);

        // Spawn offset AWAY from cursor so particles appear around it, not on it
        const offsetAngle = rand(0, Math.PI * 2);
        const offsetDist  = rand(18, 50);
        const spawnX = mx + Math.cos(offsetAngle) * offsetDist;
        const spawnY = my + Math.sin(offsetAngle) * offsetDist;

        // Drift gently away from cursor center
        const driftAngle = offsetAngle; // drift outward from cursor
        const speed = rand(0.1, 0.35);

        particles.current.push({
          x:     spawnX,
          y:     spawnY,
          vx:    Math.cos(driftAngle) * speed,
          vy:    Math.sin(driftAngle) * speed - rand(0.05, 0.2), // slight upward bias
          life:  1.0,
          decay: rand(0.006, 0.014),  // slow fade
          size:  rand(1.0, 2.5),
          r, g, b,
        });
      }

      if (particles.current.length > MAX_PARTICLES) {
        particles.current.splice(0, particles.current.length - MAX_PARTICLES);
      }
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      spawnAt(mouseRef.current.x, mouseRef.current.y);
    };

    const onTouchMove = (e) => {
      const rect  = canvas.getBoundingClientRect();
      const t     = e.touches[0];
      mouseRef.current = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      spawnAt(mouseRef.current.x, mouseRef.current.y);
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;

      // Soft fade trail — not a hard clear
      ctx.fillStyle = 'rgba(3,3,3,0.15)';
      ctx.fillRect(0, 0, W, H);

      // Subtle ambient centre glow (always visible, hint of violet)
      const cx = W * 0.5, cy = H * 0.5;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W,H) * 0.38);
      bg.addColorStop(0, 'rgba(76,29,149,0.07)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Remove dead particles
      particles.current = particles.current.filter(p => p.life > 0.01);

      particles.current.forEach(p => {
        // Physics — gentle drift, minimal gravity
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x  += p.vx;
        p.y  += p.vy;
        p.life -= p.decay;

        const alpha  = Math.max(0, p.life);
        const radius = Math.max(0.01, p.size * p.life); // ← fixes negative radius crash

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(2)})`;
        ctx.fill();
      });

      // Faint cursor aura
      const { x: mx, y: my } = mouseRef.current;
      if (mx > 0) {
        const aura = ctx.createRadialGradient(mx, my, 0, mx, my, 55);
        aura.addColorStop(0, 'rgba(168,85,247,0.05)');
        aura.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(mx, my, 55, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0"
      style={{ display: 'block' }}
    />
  );
}
