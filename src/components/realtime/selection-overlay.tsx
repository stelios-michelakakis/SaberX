"use client";

import { useEffect, useState } from "react";
import { useRealtimeStore } from "./store";

type Box = {
  userId: string;
  username: string;
  color: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export function SelectionOverlay({ activeSheetId }: { activeSheetId: string }) {
  const presence = useRealtimeStore((s) => s.presence);
  const selfId = useRealtimeStore((s) => s.selfUserId);
  const [boxes, setBoxes] = useState<Box[]>([]);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const next: Box[] = [];
      for (const u of presence) {
        if (u.userId === selfId) continue;
        const sel = u.selection;
        if (!sel || sel.sheetId !== activeSheetId || !sel.rowId || !sel.fieldId) continue;
        const el = document.querySelector<HTMLElement>(
          `tr[data-row-id="${sel.rowId}"] [data-field-id="${sel.fieldId}"]`
        );
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        next.push({
          userId: u.userId,
          username: u.username,
          color: u.color,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
      }
      setBoxes(next);
    };
    measure();
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const interval = setInterval(measure, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [presence, selfId, activeSheetId]);

  if (!boxes.length) return null;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }}>
      {boxes.map((b) => (
        <div
          key={b.userId}
          style={{
            position: "absolute",
            top: b.top,
            left: b.left,
            width: b.width,
            height: b.height,
            border: `2px solid ${b.color}`,
            borderRadius: 3,
            boxSizing: "border-box",
            pointerEvents: "none"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -16,
              left: -2,
              padding: "1px 6px",
              fontSize: 10,
              fontWeight: 600,
              color: "white",
              background: b.color,
              borderRadius: "3px 3px 3px 0",
              whiteSpace: "nowrap",
              lineHeight: 1.4
            }}
          >
            {b.username}
          </div>
        </div>
      ))}
    </div>
  );
}
