import { html } from "htm/react";
import { fmtDate, ageFrom, initials, sexLong } from "../../lib/utils.js";

export function ProfileCard({ profile, position, isCenter, onClick, resolveImg }) {
  const src = resolveImg(profile.image);
  let cls = "card";
  if (isCenter) cls += " center";
  else if (Math.abs(position) === 1) cls += " adj";
  return html`
    <div className=${cls} onClick=${onClick} role="button" tabIndex=${0}
         onKeyDown=${(e) => e.key === "Enter" && onClick && onClick()}>
      <div className="card-img">
        <div className="corner">${profile.id}</div>
        <div className="corner r">${sexLong(profile.sex).split(" ")[0]}</div>
        ${profile.poi && html`<div className="poi-tag">★ POI</div>`}
        ${src
          ? html`<img src=${src} alt=${profile.firstName + " " + profile.lastName} draggable="false" />`
          : html`<div className="ph">
              <div className="glyph">${initials(profile)}</div>
              <div>${"[ NO IMG :: link folder ]"}</div>
            </div>`
        }
        ${profile.hidden && html`<div className="hidden-tag">◌ HIDDEN</div>`}
        ${profile.classified && html`
          <div className="classified-tape">
            <div className="stamp">CLASSIFIED</div>
          </div>
        `}
        ${profile.status === "deceased" && html`<div className="deceased-x" />`}
      </div>
      <div className="card-body">
        <div className="card-name">
          ${profile.firstName} <span className="last">${profile.lastName}</span>
        </div>
        <div style=${{ fontSize: 11, color: "var(--grn-3)", marginTop: 4 }}>${(profile.tags || []).slice(0, 3).join(", ")}</div>
        <div className="card-id">DOB ${fmtDate(profile.dob)} · AGE ${ageFrom(profile.dob)}</div>
        <div className="card-grid">
          <div className="k">ETHN</div><div className="v">${profile.ethnicity || "—"}</div>
          <div className="k">SEX</div><div className="v">${sexLong(profile.sex)}</div>
          <div className="k">REF</div><div className="v">${profile.id}</div>
          ${profile.status === "deceased" && html`
            <div className="k" style=${{ color: "var(--red)" }}>STATUS</div>
            <div className="v" style=${{ color: "var(--red)" }}>DECEASED</div>
          `}
          ${profile.status === "alive" && html`
            <div className="k" style=${{ color: "var(--grn-1)" }}>STATUS</div>
            <div className="v" style=${{ color: "var(--grn-1)" }}>ALIVE</div>
          `}
        </div>
      </div>
    </div>
  `;
}
