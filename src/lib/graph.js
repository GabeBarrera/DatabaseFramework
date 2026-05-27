import { FAMILY_TYPES, PC_TYPES } from "../constants/relationships.js";

export function buildRelGraph(profiles, hiddenIds) {
  const visible    = profiles.filter((p) => !hiddenIds.has(p.id));
  const visibleSet = new Set(visible.map((p) => p.id));

  const parentOf   = {};
  const childrenOf = {};
  const addPC = (parentId, childId) => {
    if (!visibleSet.has(parentId) || !visibleSet.has(childId) || parentId === childId) return;
    if (!parentOf[childId])    parentOf[childId]    = [];
    if (!childrenOf[parentId]) childrenOf[parentId] = [];
    if (!parentOf[childId].includes(parentId))    parentOf[childId].push(parentId);
    if (!childrenOf[parentId].includes(childId))  childrenOf[parentId].push(childId);
  };
  visible.forEach((p) => {
    (p.relationships || []).forEach((r) => {
      if (!r.refId || !visibleSet.has(r.refId)) return;
      const t = (r.type || "").toLowerCase();
      if (["mother","father","parent"].includes(t)) addPC(r.refId, p.id);
      if (["child","son","daughter"].includes(t))   addPC(p.id, r.refId);
    });
  });

  const fgMap        = {};
  const childInGroup = new Set();
  Object.entries(parentOf).forEach(([childId, parents]) => {
    if (parents.length >= 2) {
      const [p1, p2] = [...parents].sort();
      const key = `${p1}::${p2}`;
      if (!fgMap[key]) fgMap[key] = { p1, p2, children: new Set() };
      fgMap[key].children.add(childId);
      childInGroup.add(childId);
    }
  });
  const familyGroups = Object.values(fgMap).map((fg) => ({
    p1: fg.p1, p2: fg.p2, children: [...fg.children],
  }));
  const singleParentEdges = [];
  Object.entries(parentOf).forEach(([childId, parents]) => {
    if (!childInGroup.has(childId)) singleParentEdges.push({ parent: parents[0], child: childId });
  });

  const isGPGCRedundant = (gpId, gcId) =>
    (parentOf[gcId] || []).some((pId) => (parentOf[pId] || []).includes(gpId));

  const isCousinRedundant = (aId, bId) => {
    for (const pA of (parentOf[aId] || [])) {
      for (const gp of (parentOf[pA] || [])) {
        for (const pB of (childrenOf[gp] || [])) {
          if (pB !== pA && (parentOf[bId] || []).includes(pB)) return true;
        }
      }
    }
    return false;
  };

  const seen             = new Set();
  const socialEdges      = [];
  const familyDirectEdges = [];

  visible.forEach((p) => {
    (p.relationships || []).forEach((r) => {
      if (!r.refId || !visibleSet.has(r.refId)) return;
      const t   = (r.type || "").toLowerCase();
      if (PC_TYPES.has(t)) return;
      const key = [p.id, r.refId].sort().join("↔");
      if (seen.has(key)) return;
      seen.add(key);
      if (FAMILY_TYPES.has(t)) {
        if (t === "grandparent" && isGPGCRedundant(r.refId, p.id)) return;
        if (t === "grandchild"  && isGPGCRedundant(p.id, r.refId)) return;
        if (t === "cousin"      && isCousinRedundant(p.id, r.refId)) return;
        familyDirectEdges.push({ source: p.id, target: r.refId, label: t });
      } else {
        socialEdges.push({ source: p.id, target: r.refId, label: t });
      }
    });
  });

  const connectedIds = new Set();
  const mark = (a, b) => { connectedIds.add(a); connectedIds.add(b); };
  socialEdges.forEach((e)       => mark(e.source, e.target));
  familyDirectEdges.forEach((e) => mark(e.source, e.target));
  singleParentEdges.forEach((e) => mark(e.parent, e.child));
  familyGroups.forEach((fg) => {
    connectedIds.add(fg.p1); connectedIds.add(fg.p2);
    fg.children.forEach((id) => connectedIds.add(id));
  });

  const allEdges = [
    ...socialEdges,
    ...familyDirectEdges,
    ...singleParentEdges.map((e) => ({ source: e.parent, target: e.child })),
    ...familyGroups.flatMap((fg) => [
      { source: fg.p1, target: fg.p2 },
      ...fg.children.map((c) => ({ source: fg.p1, target: c })),
      ...fg.children.map((c) => ({ source: fg.p2, target: c })),
    ]),
  ];

  return {
    connected: visible.filter((p) =>  connectedIds.has(p.id)),
    isolated:  visible.filter((p) => !connectedIds.has(p.id)),
    socialEdges, familyDirectEdges, familyGroups, singleParentEdges, allEdges,
  };
}

export function forceLayout(nodes, edges, W, H, NW, NH, iters) {
  if (nodes.length === 0) return {};

  const MIN_D = Math.hypot(NW, NH) * 0.68 + 32;
  const BND   = 12;

  const adj = {};
  nodes.forEach((n) => { adj[n.id] = []; });
  edges.forEach((e) => {
    if (adj[e.source]) adj[e.source].push(e.target);
    if (adj[e.target]) adj[e.target].push(e.source);
  });
  const visited = new Set();
  const components = [];
  nodes.forEach((n) => {
    if (visited.has(n.id)) return;
    const comp = [];
    const queue = [n.id];
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      comp.push(cur);
      adj[cur].forEach((nb) => { if (!visited.has(nb)) queue.push(nb); });
    }
    components.push(comp);
  });
  const nC = components.length;
  const compR = components.map((c) => Math.max(MIN_D * 0.7, Math.sqrt(c.length) * MIN_D * 0.6));

  const compCx = [], compCy = [];
  const margin = MIN_D;
  const uw = W - margin * 2, uh = H - margin * 2;

  if (nC === 1) {
    compCx[0] = W / 2; compCy[0] = H / 2;
  } else if (nC === 2) {
    compCx[0] = margin + uw * 0.28; compCy[0] = H / 2;
    compCx[1] = margin + uw * 0.72; compCy[1] = H / 2;
  } else {
    const cr = Math.min(uw, uh) * 0.30;
    components.forEach((_, i) => {
      const ang = (i / nC) * Math.PI * 2 - Math.PI / 2;
      compCx[i] = W / 2 + cr * Math.cos(ang);
      compCy[i] = H / 2 + cr * Math.sin(ang);
    });
  }

  const pos = {};
  components.forEach((comp, ci) => {
    const r0 = Math.max(MIN_D * 0.3, (comp.length - 1) * MIN_D * 0.28);
    comp.forEach((id, i) => {
      const ang = (i / Math.max(1, comp.length)) * Math.PI * 2;
      pos[id] = {
        x: compCx[ci] + r0 * Math.cos(ang) + (Math.random() - 0.5) * 6,
        y: compCy[ci] + r0 * Math.sin(ang) + (Math.random() - 0.5) * 6,
        vx: 0, vy: 0,
      };
    });
  });

  const ids    = nodes.map((n) => n.id);
  const REPEL  = MIN_D * MIN_D * 2.2;
  const COL_K  = 1.4;
  const K_S    = 0.05;
  const L_REST = MIN_D * 1.6;
  const COMP_G = 0.05;
  const GLOBAL_G = 0.004;
  const INTER_K = 0.14;

  for (let it = 0; it < iters; it++) {
    const t    = it / iters;
    const damp = 0.90 - 0.32 * t;

    const fx = {}, fy = {};
    ids.forEach((id) => { fx[id] = 0; fy[id] = 0; });

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]], b = pos[ids[j]];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const ux = dx / d, uy = dy / d;
        const rf = REPEL / (d * d);
        fx[ids[i]] -= rf * ux; fy[ids[i]] -= rf * uy;
        fx[ids[j]] += rf * ux; fy[ids[j]] += rf * uy;
        if (d < MIN_D) {
          const cf = COL_K * (MIN_D - d);
          fx[ids[i]] -= cf * ux; fy[ids[i]] -= cf * uy;
          fx[ids[j]] += cf * ux; fy[ids[j]] += cf * uy;
        }
      }
    }

    edges.forEach((e) => {
      const a = pos[e.source], b = pos[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d  = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const sf = K_S * (d - L_REST);
      fx[e.source] += sf * dx / d; fy[e.source] += sf * dy / d;
      fx[e.target] -= sf * dx / d; fy[e.target] -= sf * dy / d;
    });

    components.forEach((comp) => {
      if (comp.length < 2) return;
      let cx = 0, cy = 0;
      comp.forEach((id) => { cx += pos[id].x; cy += pos[id].y; });
      cx /= comp.length; cy /= comp.length;
      comp.forEach((id) => {
        fx[id] += COMP_G * (cx - pos[id].x);
        fy[id] += COMP_G * (cy - pos[id].y);
      });
    });

    if (nC > 1) {
      const cens = components.map((comp) => {
        let cx = 0, cy = 0;
        comp.forEach((id) => { cx += pos[id].x; cy += pos[id].y; });
        return { x: cx / comp.length, y: cy / comp.length };
      });
      for (let i = 0; i < nC; i++) {
        for (let j = i + 1; j < nC; j++) {
          const dx = cens[j].x - cens[i].x, dy = cens[j].y - cens[i].y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minSep = compR[i] + compR[j] + MIN_D * 1.1;
          if (d < minSep) {
            const f  = INTER_K * (minSep - d);
            const ux = dx / d, uy = dy / d;
            components[i].forEach((id) => { fx[id] -= f * ux; fy[id] -= f * uy; });
            components[j].forEach((id) => { fx[id] += f * ux; fy[id] += f * uy; });
          }
        }
      }
    }

    ids.forEach((id) => {
      fx[id] += GLOBAL_G * (W / 2 - pos[id].x);
      fy[id] += GLOBAL_G * (H / 2 - pos[id].y);
    });

    const maxV = MIN_D * 0.55;
    ids.forEach((id) => {
      const p = pos[id];
      p.vx = (p.vx + fx[id]) * damp;
      p.vy = (p.vy + fy[id]) * damp;
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > maxV) { p.vx *= maxV / spd; p.vy *= maxV / spd; }
      p.x = Math.max(NW / 2 + BND, Math.min(W - NW / 2 - BND, p.x + p.vx));
      p.y = Math.max(NH / 2 + BND, Math.min(H - NH / 2 - BND, p.y + p.vy));
    });
  }

  for (let pass = 0; pass < 30; pass++) {
    let clean = true;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]], b = pos[ids[j]];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (d < MIN_D) {
          clean = false;
          const push = (MIN_D - d) / 2 + 0.5;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
          a.x = Math.max(NW/2+BND, Math.min(W-NW/2-BND, a.x));
          a.y = Math.max(NH/2+BND, Math.min(H-NH/2-BND, a.y));
          b.x = Math.max(NW/2+BND, Math.min(W-NW/2-BND, b.x));
          b.y = Math.max(NH/2+BND, Math.min(H-NH/2-BND, b.y));
        }
      }
    }
    if (clean) break;
  }

  return pos;
}
