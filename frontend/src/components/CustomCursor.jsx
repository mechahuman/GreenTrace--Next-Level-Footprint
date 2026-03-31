import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef    = useRef(null);
  const ringRef   = useRef(null);
  const pos       = useRef({ x: -100, y: -100 });
  const ring      = useRef({ x: -100, y: -100 });
  const animId    = useRef(null);
  const isHover   = useRef(false);

  useEffect(() => {
    const dot  = dotRef.current;
    const ringEl = ringRef.current;

    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
    };

    // Detect hoverable elements to enlarge the ring
    const onEnter = (e) => {
      if (e.target.closest('button, a, [role="button"], select, input, label')) {
        isHover.current = true;
      }
    };
    const onLeave = (e) => {
      if (e.target.closest('button, a, [role="button"], select, input, label')) {
        isHover.current = false;
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onEnter);
    document.addEventListener('mouseout',  onLeave);

    const animate = () => {
      // Dot: instant
      dot.style.transform = `translate(${pos.current.x - 4}px, ${pos.current.y - 4}px)`;

      // Ring: lerp for smooth lag
      ring.current.x += (pos.current.x - ring.current.x) * 0.12;
      ring.current.y += (pos.current.y - ring.current.y) * 0.12;

      const size = isHover.current ? 36 : 24;
      ringEl.style.transform = `translate(${ring.current.x - size / 2}px, ${ring.current.y - size / 2}px)`;
      ringEl.style.width  = `${size}px`;
      ringEl.style.height = `${size}px`;
      ringEl.style.opacity = isHover.current ? '0.8' : '0.5';

      animId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onEnter);
      document.removeEventListener('mouseout',  onLeave);
      cancelAnimationFrame(animId.current);
    };
  }, []);

  return (
    <>
      {/* Tiny filled dot — the sharp inner cursor */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#a855f7',
          pointerEvents: 'none',
          zIndex: 99999,
          willChange: 'transform',
          boxShadow: '0 0 8px 2px rgba(168, 85, 247, 0.5)',
        }}
      />

      {/* Outer trailing ring */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          pointerEvents: 'none',
          zIndex: 99998,
          willChange: 'transform, width, height',
          transition: 'width 0.15s ease, height 0.15s ease, opacity 0.15s ease',
          backdropFilter: 'none',
        }}
      />
    </>
  );
}
