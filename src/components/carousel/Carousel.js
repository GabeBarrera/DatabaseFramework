import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { html } from "htm/react";
import { ProfileCard } from "./ProfileCard.js";
import { NewEntryCard } from "./NewEntryCard.js";

export function Carousel({ profiles, index, setIndex, onSelect, onNew, resolveImg }) {
  const trackRef = useRef(null);
  const startX = useRef(null);
  const lastDx = useRef(0);
  const items = useMemo(() => {
    return [...profiles.map((p) => ({ kind: "profile", profile: p })), { kind: "new" }];
  }, [profiles]);
  const total = items.length;

  const go = useCallback((delta) => {
    setIndex((i) => {
      const next = i + delta;
      if (next < 0) return 0;
      if (next > total - 1) return total - 1;
      return next;
    });
  }, [setIndex, total]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Enter") {
        const cur = items[index];
        if (!cur) return;
        if (cur.kind === "profile") onSelect(cur.profile);
        else onNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, items, index, onSelect, onNew]);

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; lastDx.current = 0; };
  const onTouchMove = (e) => {
    if (startX.current == null) return;
    lastDx.current = e.touches[0].clientX - startX.current;
  };
  const onTouchEnd = () => {
    if (startX.current == null) return;
    const dx = lastDx.current;
    startX.current = null;
    if (Math.abs(dx) > 40) {
      if (dx < 0) go(1); else go(-1);
    }
  };

  const dragRef = useRef({ active: false, x: 0 });
  const onMouseDown = (e) => { dragRef.current = { active: true, x: e.clientX, dx: 0 }; };
  const onMouseMove = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.dx = e.clientX - dragRef.current.x;
  };
  const onMouseUp = () => {
    if (!dragRef.current.active) return;
    const dx = dragRef.current.dx || 0;
    dragRef.current.active = false;
    if (Math.abs(dx) > 60) { if (dx < 0) go(1); else go(-1); }
  };

  const visible = [];
  for (let off = -2; off <= 2; off++) {
    const i = index + off;
    if (i < 0 || i >= total) continue;
    visible.push({ i, off, item: items[i] });
  }

  return html`
    <div
      className="carousel-wrap"
      onTouchStart=${onTouchStart}
      onTouchMove=${onTouchMove}
      onTouchEnd=${onTouchEnd}
      onMouseDown=${onMouseDown}
      onMouseMove=${onMouseMove}
      onMouseUp=${onMouseUp}
      onMouseLeave=${onMouseUp}
    >
      <button className="carousel-arrow left" onClick=${() => go(-1)} aria-label="Previous">
        ◀
        <span className="arrow-label">←</span>
      </button>

      <div className="track" ref=${trackRef}>
        ${visible.map(({ i, off, item }) => html`
          <${item.kind === "profile" ? ProfileCard : NewEntryCard}
            key=${i}
            ...${ item.kind === "profile" ? {
              profile: item.profile,
              position: off,
              isCenter: off === 0,
              onClick: () => { if (off === 0) onSelect(item.profile); else setIndex(i); },
              resolveImg
            } : {
              isCenter: off === 0,
              onClick: () => { if (off === 0) onNew(); else setIndex(i); }
            }}
          />
        `)}
      </div>

      <button className="carousel-arrow right" onClick=${() => go(1)} aria-label="Next">
        ▶
        <span className="arrow-label">→</span>
      </button>
    </div>
  `;
}
