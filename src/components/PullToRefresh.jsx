import { useState, useRef, useCallback } from "react";

const THRESHOLD = 80;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Apply resistance so it feels natural
      setPullY(Math.min(delta * 0.45, THRESHOLD));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (pullY >= THRESHOLD * 0.6) {
      setPullY(0);
      setRefreshing(true);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullY(0);
    }
  }, [pullY, onRefresh]);

  const showIndicator = pullY > 0 || refreshing;

  return (
    <>
      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }
        .ptr-indicator {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 40px;
          overflow: hidden;
        }
        .ptr-spinner {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2.5px solid #E0E0DC;
          border-top-color: #367C2B;
          flex-shrink: 0;
        }
        .ptr-spinner-active {
          animation: ptr-spin 0.7s linear infinite;
        }
      `}</style>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        {showIndicator && (
          <div className="ptr-indicator">
            <div
              className={`ptr-spinner${refreshing ? " ptr-spinner-active" : ""}`}
              style={{
                transform: refreshing ? undefined : `rotate(${(pullY / THRESHOLD) * 270}deg)`,
              }}
            />
          </div>
        )}
        {children}
      </div>
    </>
  );
}
