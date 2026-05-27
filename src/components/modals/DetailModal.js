import { useEffect } from "react";
import { html } from "htm/react";
import { Glitch } from "../Glitch.js";
import { fmtDate, ageFrom, initials, sexLong, downloadJSON } from "../../lib/utils.js";
import { contactMeta } from "../../constants/contacts.js";

export function DetailModal({ profile, onClose, onDelete, resolveImg, onOpenMap, onEdit, onToggleFlag, onOpenRefId }) {
  if (!profile) return null;
  const src = resolveImg(profile.image);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDownload = () => {
    const safe = (profile.firstName + "_" + profile.lastName).toLowerCase().replace(/[^a-z0-9_]/g, "");
    downloadJSON(profile, `${safe || "profile"}_${profile.id}.json`);
  };

  const statusStyle = profile.status === "deceased"
    ? { color: "var(--red)" }
    : profile.status === "alive"
    ? { color: "var(--grn-1)" }
    : {};

  return html`
    <div className="modal-veil" onMouseDown=${(e) => { if (e.target.classList.contains("modal-veil")) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="tag">RECORD</div>
          <h3>&gt; <${Glitch} className="glitch-sm">${profile.firstName.toUpperCase()} ${profile.lastName.toUpperCase()}<//>
          </h3>
          <button className="ctrl-btn" onClick=${onClose}>✕ ESC</button>
        </div>

        <div className="modal-body">
          <div>
            <div className="portrait">
              ${src
                ? html`<img src=${src} alt="" draggable="false" />`
                : html`<div className="ph">
                    <div>
                      <div style=${{ fontSize: 54, color: "var(--grn-1)", fontFamily: "var(--crt)", letterSpacing: "0.05em", lineHeight: 1 }}>${initials(profile)}</div>
                      <div style=${{ marginTop: 8 }}>[ image src not linked ]</div>
                    </div>
                  </div>`
              }
              ${profile.classified && html`
                <div className="classified-tape">
                  <div className="stamp">CLASSIFIED</div>
                </div>
              `}
              ${profile.status === "deceased" && html`<div className="deceased-x" />`}
            </div>
            <div className="portrait-meta">
              <span>FILE</span>
              <b>${profile.image || "—"}</b>
            </div>
            <div className="portrait-meta" style=${{ borderTop: "none" }}>
              <span>STATUS</span>
              <b>${src ? "LINKED" : "UNRESOLVED"}</b>
            </div>
            <div className="status-toggles" style=${{ marginTop: 10 }}>
              <button
                type="button"
                className=${"status-toggle poi " + (profile.poi ? "on" : "")}
                onClick=${() => onToggleFlag && onToggleFlag(profile, "poi")}
                title="Point of Interest — pinned to top of carousel"
              >★ POI</button>
              <button
                type="button"
                className=${"status-toggle hidden " + (profile.hidden ? "on" : "")}
                onClick=${() => onToggleFlag && onToggleFlag(profile, "hidden")}
                title="Hidden — no map geocoding"
              >◌ HIDDEN</button>
              <button
                type="button"
                className=${"status-toggle classified " + (profile.classified ? "on" : "")}
                onClick=${() => onToggleFlag && onToggleFlag(profile, "classified")}
                title="Classified — hidden from carousel/search until shell unlocks it"
              >▮ CLASSIFIED</button>
            </div>
          </div>

          <div>
            <div className="field-grid">
              <div className="field">
                <span className="k">First Name</span>
                <div className="v">${profile.firstName}</div>
              </div>
              <div className="field">
                <span className="k">Last Name</span>
                <div className="v">${profile.lastName}</div>
              </div>
              <div className="field">
                <span className="k">Date of Birth</span>
                <div className="v">${fmtDate(profile.dob)} <span className="dim">/ AGE ${ageFrom(profile.dob)}</span></div>
              </div>
              <div className="field">
                <span className="k">Status</span>
                <div className="v" style=${statusStyle}>
                  ${profile.status ? profile.status.toUpperCase() : "—"}
                </div>
              </div>
              <div className="field">
                <span className="k">Ethnicity</span>
                <div className="v">${profile.ethnicity || "—"}</div>
              </div>
              <div className="field">
                <span className="k">Sex</span>
                <div className="v">${sexLong(profile.sex)}</div>
              </div>
              <div className="field">
                <span className="k">Country</span>
                <div className="v">${profile.country || "—"}</div>
              </div>
              <div className="field">
                <span className="k">Tags</span>
                <div className="v">${(profile.tags || []).length ? (profile.tags || []).join(", ") : "—"}</div>
              </div>
              <div className="field">
                <span className="k">Reference ID</span>
                <div className="v">${profile.id}</div>
              </div>
              <div className="field full">
                <span className="k">Address</span>
                <div className="v">
                  ${profile.address
                    ? html`<span
                        className="addr-link"
                        onClick=${() => onOpenMap && onOpenMap(profile)}
                        title="open on map"
                      >
                        ${profile.address}
                        <span className="addr-tag">→ MAP</span>
                      </span>`
                    : "—"
                  }
                </div>
              </div>
              <div className="field full">
                <span className="k">Description</span>
                <div className="v">${profile.description || "—"}</div>
              </div>
            </div>

            <div className="contacts-list">
              <div className="head">
                <span>// CONTACT_METHODS</span>
                <span className="dim">${(profile.contacts || []).length} record(s)</span>
              </div>
              ${(profile.contacts || []).length === 0
                ? html`<div className="contact-item" style=${{ gridTemplateColumns: "1fr", color: "var(--dim)" }}>
                    [ no contact methods on file ]
                  </div>`
                : (profile.contacts || []).map((c, i) => {
                    const meta = contactMeta(c.type);
                    const href = meta.href ? meta.href(c.value) : null;
                    return html`
                      <div className="contact-item" key=${i}>
                        <div className="ic">${meta.glyph}</div>
                        <div className="tp">${meta.label}</div>
                        <div className="vl">
                          ${href
                            ? html`<a href=${href} target="_blank" rel="noopener noreferrer">${c.value}</a>`
                            : c.value
                          }
                        </div>
                        <div className="copy" onClick=${() => { try { navigator.clipboard.writeText(c.value); } catch (e) {} }}>copy</div>
                      </div>
                    `;
                  })
              }
            </div>

            <div className="contacts-list">
              <div className="head">
                <span>// RELATIONSHIPS</span>
                <span className="dim">${(profile.relationships || []).length} record(s)</span>
              </div>
              ${(profile.relationships || []).length === 0
                ? html`<div className="contact-item" style=${{ gridTemplateColumns: "1fr", color: "var(--dim)" }}>
                    [ no relationships on file ]
                  </div>`
                : (profile.relationships || []).map((r, i) => html`
                    <div className="contact-item" key=${i}>
                      <div className="ic">~</div>
                      <div className="tp">${r.type || "—"}</div>
                      <div className="vl">
                        ${r.name || "—"}
                        ${r.refId && html`
                          <span
                            className="refid-link"
                            onClick=${() => onOpenRefId && onOpenRefId(r.refId)}
                            title="open referenced profile"
                          > [${r.refId}]</span>
                        `}
                      </div>
                      <div className="copy" onClick=${() => { try { navigator.clipboard.writeText((r.name || "") + (r.refId ? " " + r.refId : "")); } catch (e) {} }}>copy</div>
                    </div>
                  `)
              }
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <div className="foot-hint">
            <span className="kbd">ESC</span> close &nbsp;·&nbsp; <span className="kbd">←</span><span className="kbd">→</span> navigate &nbsp;·&nbsp; record is read-only
          </div>
          <div className="foot-actions">
            ${onDelete && html`
              <button className="ctrl-btn danger" onClick=${() => {
                if (window.confirm("Delete this record? This cannot be undone.")) onDelete(profile);
              }}>✕ DELETE</button>
            `}
            ${onEdit && html`
              <button className="ctrl-btn" onClick=${() => onEdit(profile)}>✎ EDIT</button>
            `}
            <button className="ctrl-btn primary" onClick=${handleDownload}>
              ⬇ DOWNLOAD .json
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
