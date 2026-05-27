import { useMemo } from "react";
import { html } from "htm/react";
import { fmtDate, ageFrom } from "../../lib/utils.js";

const alpha = (a, b) => {
  const la = (a.lastName || "").toLowerCase();
  const lb = (b.lastName || "").toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  const fa = (a.firstName || "").toLowerCase();
  const fb = (b.firstName || "").toLowerCase();
  return fa < fb ? -1 : fa > fb ? 1 : 0;
};

export function ProfileList({ profiles, onSelect }) {
  const sorted = useMemo(() => {
    const pois = profiles.filter((p) => p.poi).sort(alpha);
    const rest = profiles.filter((p) => !p.poi).sort(alpha);
    return [...pois, ...rest];
  }, [profiles]);

  if (!sorted.length) {
    return html`<div className="plist-empty"><span className="dim">// no records</span></div>`;
  }

  return html`
    <div className="plist-wrap">
      <div className="plist-header">
        <span>NAME</span>
        <span>REF</span>
        <span>DOB / AGE</span>
        <span>SEX</span>
        <span>ETHNICITY</span>
        <span>STATUS</span>
        <span>ADDRESS</span>
      </div>
      ${sorted.map((p) => {
        let cls = "plist-row";
        if (p.poi)                   cls += " is-poi";
        if (p.status === "deceased") cls += " is-deceased";
        return html`
          <div key=${p.id} className=${cls} onClick=${() => onSelect(p)}>
            <div className="plist-name">
              ${p.poi && html`<span className="plist-star">★</span>`}
              <span className="plist-fn">${p.firstName}</span>
              <span className="plist-ln">${p.lastName}</span>
              ${p.hidden     && html`<span className="plist-badge">◌ HIDDEN</span>`}
              ${p.classified && html`<span className="plist-badge plist-badge-red">CLASSIFIED</span>`}
            </div>
            <div className="plist-id">${p.id}</div>
            <div className="plist-dob">
              ${fmtDate(p.dob)}<span className="plist-age"> · ${ageFrom(p.dob)}</span>
            </div>
            <div className="plist-sex">${p.sex || "—"}</div>
            <div className="plist-ethn">${p.ethnicity || "—"}</div>
            <div className="plist-status ${p.status === "deceased" ? "plist-status-dead" : ""}">
              ${p.status || "—"}
            </div>
            <div className="plist-addr">${p.address || "—"}</div>
          </div>
        `;
      })}
    </div>
  `;
}
