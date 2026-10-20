// Pull down from the top of the screen to refresh.
// Works with a finger on a phone. (On a computer, use the "Sync now" link.)

import { useEffect, useRef, useState } from 'react';

const TRIGGER = 50; // how far the bar must open before it refreshes

export default function PullToRefresh({
  onRefresh,
  busy,
  children,
}: {
  onRefresh: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    function onStart(e: TouchEvent) {
      // Only start when the page is scrolled all the way to the top.
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      pullRef.current = distance > 0 ? Math.min(distance / 2, 100) : 0; // /2 = feels "heavy"
      setPull(pullRef.current);
    }
    function onEnd() {
      if (pullRef.current >= TRIGGER) refresh.current();
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    }
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const ready = pull >= TRIGGER;
  const show = busy || pull > 8;

  return (
    <>
      <div className="ptr" style={{ height: busy ? 40 : pull }} aria-live="polite">
        {show && (
          <span className={busy ? 'ptr-label spinning' : 'ptr-label'}>
            {busy ? 'Syncing lessons…' : ready ? 'Release to sync' : 'Pull to sync'}
          </span>
        )}
      </div>
      {children}
    </>
  );
}
