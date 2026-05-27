import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { html } from "htm/react";
import { buildRelGraph, forceLayout } from "../../lib/graph.js";
import { initials } from "../../lib/utils.js";

const NODE_W = 152, NODE_H = 64, ISO_X = 18;

export function RelationshipsModal({ profiles, onClose, onSelect }) {
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [listOpen, setListOpen] = useState(true);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const canvasDragRef = useRef(null);
  const nodeDragRef = useRef(null);
  const nodeWasDragged = useRef(false);

  useEffect(() => { transformRef.current = transform; }, [transform]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const {
    connected, isolated,
    socialEdges, familyDirectEdges, familyGroups, singleParentEdges, allEdges,
  } = useMemo(() => buildRelGraph(profiles, hiddenIds), [profiles, hiddenIds]);

  const isolatedSet = useMemo(() => new Set(isolated.map((p) => p.id)), [isolated]);

  const isoColW = isolated.length > 0 ? NODE_W + ISO_X * 2 + 28 : 0;
  const netArea = useMemo(() => ({
    w: Math.max(160, size.w - isoColW), h: size.h, ox: isoColW
  }), [size.w, size.h, isoColW]);

  const [positions, setPositions] = useState({});
  const sizeKey = `${Math.round(netArea.w)}x${Math.round(netArea.h)}`;
  const visibleKey = [...connected, ...isolated].map((p) => p.id).sort().join(",");
  const layoutRef = useRef({ sizeKey: null, visibleKey: null });

  useEffect(() => {
    const prev = layoutRef.current;
    const fullReset = sizeKey !== prev.sizeKey;
    const nodesChanged = visibleKey !== prev.visibleKey;
    layoutRef.current = { sizeKey, visibleKey };
    if (!fullReset && !nodesChanged) return;

    setPositions((cur) => {
      if (fullReset) {
        const out = {};
        isolated.forEach((p, i) => {
          out[p.id] = { x: ISO_X + NODE_W / 2, y: 72 + i * (NODE_H + 16) };
        });
        if (connected.length > 0) {
          const raw = forceLayout(connected, allEdges, netArea.w, netArea.h, NODE_W, NODE_H, 380);
          Object.keys(raw).forEach((id) => { out[id] = { x: raw[id].x + netArea.ox, y: raw[id].y }; });
        }
        return out;
      }
      const out = { ...cur };
      let changed = false;
      isolated.forEach((p, i) => {
        if (out[p.id] == null) {
          out[p.id] = { x: ISO_X + NODE_W / 2, y: 72 + i * (NODE_H + 16) };
          changed = true;
        }
      });
      connected.forEach((p) => {
        if (out[p.id] == null) {
          out[p.id] = {
            x: netArea.ox + netArea.w / 2 + (Math.random() - 0.5) * 140,
            y: netArea.h / 2 + (Math.random() - 0.5) * 140,
          };
          changed = true;
        }
      });
      return changed ? out : cur;
    });
  }, [sizeKey, visibleKey]);

  const toLocal = (clientX, clientY) => {
    const rect = svgRef.current ? svgRef.current.getBoundingClientRect() : { left: 0, top: 0 };
    const t = transformRef.current;
    return { x: (clientX - rect.left - t.x) / t.k, y: (clientY - rect.top - t.y) / t.k };
  };

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => {
      const newK = Math.max(0.2, Math.min(5, t.k * factor));
      const rect = svgRef.current ? svgRef.current.getBoundingClientRect() : { left: 0, top: 0 };
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      return { k: newK, x: mx - (mx - t.x) * (newK / t.k), y: my - (my - t.y) * (newK / t.k) };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onNodeMouseDown = (e, id) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const local = toLocal(e.clientX, e.clientY);
    const pos = positions[id] || { x: 0, y: 0 };
    nodeDragRef.current = { id, ox: local.x - pos.x, oy: local.y - pos.y, moved: false };
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    canvasDragRef.current = { sx: e.clientX - transform.x, sy: e.clientY - transform.y };
    svgRef.current && svgRef.current.classList.add("dragging");
  };

  const onMouseMove = (e) => {
    if (nodeDragRef.current) {
      nodeDragRef.current.moved = true;
      const { id, ox, oy } = nodeDragRef.current;
      const local = toLocal(e.clientX, e.clientY);
      setPositions((p) => ({ ...p, [id]: { x: local.x - ox, y: local.y - oy } }));
      return;
    }
    if (!canvasDragRef.current) return;
    setTransform((t) => ({ ...t, x: e.clientX - canvasDragRef.current.sx, y: e.clientY - canvasDragRef.current.sy }));
  };

  const onMouseUp = () => {
    nodeWasDragged.current = !!(nodeDragRef.current && nodeDragRef.current.moved);
    nodeDragRef.current = null;
    canvasDragRef.current = null;
    svgRef.current && svgRef.current.classList.remove("dragging");
  };

  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });
  const toggleHidden = (id) => setHiddenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const showAll = () => setHiddenIds(new Set());
  const hideAll = () => setHiddenIds(new Set(profiles.map((p) => p.id)));

  const totalVisible = connected.length + isolated.length;

  return html`
    <div className="rel-modal">
      <div className="rel-toolbar">
        <div className="rel-toolbar-title">
          // RELATIONSHIPS > <span style=${{ color: "var(--grn-0)" }}>NETWORK_VIEW</span>
        </div>
        <div className="rel-toolbar-stats">
          <span>NODES <b>${totalVisible}</b></span>
          <span>EDGES <b>${allEdges.length}</b></span>
          <span>ISOLATED <b>${isolated.length}</b></span>
        </div>
        <button className="ctrl-btn" onClick=${() => setListOpen((v) => !v)}>
          ${listOpen ? "◀ HIDE LIST" : "▶ SHOW LIST"}
        </button>
        <button className="ctrl-btn" onClick=${onClose}>✕ ESC</button>
      </div>

      <div className="rel-body">
        <div className="rel-canvas-wrap" ref=${wrapRef}>
          <svg
            ref=${svgRef}
            className="rel-svg"
            onMouseDown=${onMouseDown}
            onMouseMove=${onMouseMove}
            onMouseUp=${onMouseUp}
            onMouseLeave=${onMouseUp}
          >
            <g transform=${"translate(" + transform.x + "," + transform.y + ") scale(" + transform.k + ")"}>

              ${isolated.length > 0 && html`
                <line
                  x1=${isoColW - 1} y1=${0} x2=${isoColW - 1} y2=${size.h}
                  stroke="rgba(14,42,26,0.7)" strokeWidth="1" strokeDasharray="4 7"
                />
                <text x=${ISO_X} y=${28}
                  style=${{ fill: "var(--grn-4)", fontSize: 9, letterSpacing: "0.22em", fontFamily: "var(--mono)", textTransform: "uppercase" }}
                >// ISOLATED</text>
                <text x=${ISO_X} y=${42}
                  style=${{ fill: "var(--grn-5)", fontSize: 7.5, letterSpacing: "0.14em", fontFamily: "var(--mono)" }}
                >NO CONNECTIONS</text>
              `}

              ${connected.length > 0 && html`
                <text x=${netArea.ox + 12} y=${20}
                  style=${{ fill: "var(--grn-5)", fontSize: 9, letterSpacing: "0.2em", fontFamily: "var(--mono)" }}
                >// NETWORK</text>
              `}

              ${socialEdges.map((e) => {
                const a = positions[e.source], b = positions[e.target];
                if (!a || !b) return null;
                const lx = (a.x + b.x) / 2, ly = (a.y + b.y) / 2 - 9;
                return html`
                  <g key=${"se-" + e.source + "-" + e.target}>
                    <line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}
                      stroke="rgba(0,140,56,0.5)" strokeWidth="1.2" strokeDasharray="5 4" />
                    <text x=${lx} y=${ly} textAnchor="middle"
                      style=${{ fill: "var(--amber)", fontSize: 8.5, fontFamily: "var(--mono)", letterSpacing: "0.1em", pointerEvents: "none" }}
                    >[${e.label.toUpperCase()}]</text>
                  </g>
                `;
              })}

              ${familyDirectEdges.map((e) => {
                const a = positions[e.source], b = positions[e.target];
                if (!a || !b) return null;
                const lx = (a.x + b.x) / 2, ly = (a.y + b.y) / 2 - 9;
                return html`
                  <g key=${"fe-" + e.source + "-" + e.target}>
                    <line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}
                      stroke="rgba(255,51,85,0.6)" strokeWidth="1.2" strokeDasharray="5 4" />
                    <text x=${lx} y=${ly} textAnchor="middle"
                      style=${{ fill: "rgba(255,120,140,0.95)", fontSize: 8.5, fontFamily: "var(--mono)", letterSpacing: "0.1em", pointerEvents: "none" }}
                    >[${e.label.toUpperCase()}]</text>
                  </g>
                `;
              })}

              ${singleParentEdges.map((e) => {
                const a = positions[e.parent], b = positions[e.child];
                if (!a || !b) return null;
                return html`
                  <line key=${"sp-" + e.parent + "-" + e.child}
                    x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}
                    stroke="rgba(255,51,85,0.6)" strokeWidth="1.5" strokeDasharray="5 3"
                  />
                `;
              })}

              ${familyGroups.map((fg) => {
                const p1 = positions[fg.p1], p2 = positions[fg.p2];
                if (!p1 || !p2) return null;
                const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                return html`
                  <g key=${"fg-" + fg.p1 + "-" + fg.p2}>
                    <line x1=${p1.x} y1=${p1.y} x2=${p2.x} y2=${p2.y}
                      stroke="rgba(255,51,85,0.65)" strokeWidth="1.5" strokeDasharray="5 3" />
                    <circle cx=${mx} cy=${my} r=${3.5} fill="rgba(255,51,85,0.85)" />
                    ${fg.children.map((cId) => {
                      const cp = positions[cId];
                      if (!cp) return null;
                      return html`
                        <line key=${"fgc-" + cId}
                          x1=${mx} y1=${my} x2=${cp.x} y2=${cp.y}
                          stroke="rgba(255,51,85,0.65)" strokeWidth="1.5" strokeDasharray="5 3"
                        />
                      `;
                    })}
                  </g>
                `;
              })}

              ${[...connected, ...isolated].map((p) => {
                const pos = positions[p.id];
                if (!pos) return null;
                const nx = pos.x - NODE_W / 2, ny = pos.y - NODE_H / 2;
                const isIso = isolatedSet.has(p.id);
                const fullName = (p.firstName + " " + p.lastName).toUpperCase();
                const displayName = fullName.length > 17 ? fullName.slice(0, 16) + "…" : fullName;
                return html`
                  <g
                    key=${p.id}
                    className="rel-node"
                    transform=${"translate(" + nx + "," + ny + ")"}
                    onMouseDown=${(e) => onNodeMouseDown(e, p.id)}
                    onClick=${() => {
                      if (nodeWasDragged.current) { nodeWasDragged.current = false; return; }
                      onSelect(p);
                    }}
                  >
                    ${p.poi && html`<rect width=${NODE_W} height=${NODE_H} fill="none" stroke="rgba(255,203,31,0.22)" strokeWidth="3" />`}
                    <rect className="node-bg" width=${NODE_W} height=${NODE_H}
                      fill="#030a06"
                      stroke=${isIso ? "var(--grn-5)" : "var(--grn-3)"}
                      strokeWidth="1"
                    />
                    <rect width=${NODE_W} height=${2} fill=${isIso ? "var(--grn-5)" : "var(--grn-0)"} opacity="0.45" />
                    <rect x=${8} y=${10} width=${22} height=${22} fill="#061a10" stroke="var(--line-2)" strokeWidth="1" />
                    <text x=${19} y=${25} textAnchor="middle"
                      style=${{ fill: "var(--grn-1)", fontSize: 9, fontFamily: "var(--mono)", fontWeight: 700 }}
                    >${initials(p)}</text>
                    <text x=${38} y=${22}
                      style=${{ fill: isIso ? "var(--grn-3)" : "var(--grn-0)", fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, letterSpacing: "0.04em" }}
                    >${displayName}</text>
                    <text x=${38} y=${34}
                      style=${{ fill: "var(--grn-4)", fontSize: 8.5, fontFamily: "var(--mono)", letterSpacing: "0.12em" }}
                    >${p.id}</text>
                    <text x=${8} y=${56}
                      style=${{ fill: "var(--dim)", fontSize: 8, fontFamily: "var(--mono)", letterSpacing: "0.08em" }}
                    >${(p.relationships || []).length} rel · ${isIso ? "ISOLATED" : "LINKED"}</text>
                    ${p.poi && html`
                      <text x=${NODE_W - 8} y=${14} textAnchor="end"
                        style=${{ fill: "var(--amber)", fontSize: 10, fontFamily: "var(--mono)" }}
                      >★</text>
                    `}
                    ${p.classified && html`
                      <rect x=${NODE_W - 62} y=${NODE_H - 15} width=${60} height=${12}
                        fill="rgba(255,51,85,0.12)" stroke="rgba(255,51,85,0.38)" strokeWidth="0.5" />
                      <text x=${NODE_W - 32} y=${NODE_H - 6} textAnchor="middle"
                        style=${{ fill: "var(--red)", fontSize: 6.5, fontFamily: "var(--mono)", letterSpacing: "0.12em" }}
                      >CLASSIFIED</text>
                    `}
                  </g>
                `;
              })}
            </g>
          </svg>

          <div className="rel-hint">scroll to zoom · drag canvas to pan · drag nodes to rearrange · click to open</div>

          <div className="rel-zoom-btns">
            <button onClick=${() => setTransform((t) => ({ ...t, k: Math.min(5, t.k * 1.2) }))}>+</button>
            <button onClick=${resetView} style=${{ fontSize: 10, letterSpacing: "0.08em" }}>FIT</button>
            <button onClick=${() => setTransform((t) => ({ ...t, k: Math.max(0.2, t.k / 1.2) }))}>−</button>
          </div>
        </div>

        <div className=${"rel-list" + (listOpen ? "" : " collapsed")}>
          <div className="rel-list-head">
            <span>// PROFILES</span><span className="bar" />
            <span style=${{ color: "var(--dim)", fontSize: 9 }}>${totalVisible}/${profiles.length}</span>
          </div>
          <div className="rel-list-body">
            ${profiles.map((p) => {
              const hidden = hiddenIds.has(p.id);
              return html`
                <div key=${p.id} className=${"rel-list-row" + (hidden ? " faded" : "")}>
                  <div className="rl-init">${initials(p)}</div>
                  <div>
                    <div className="rl-name">${p.firstName} ${p.lastName}</div>
                    <div className="rl-id">${p.id}</div>
                  </div>
                  <button className="rl-eye" onClick=${() => toggleHidden(p.id)} title=${hidden ? "Show" : "Hide"}>
                    ${hidden ? "○" : "●"}
                  </button>
                </div>
              `;
            })}
          </div>
          <div className="rel-list-foot">
            <button onClick=${showAll}>SHOW ALL</button>
            <button onClick=${hideAll}>HIDE ALL</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
