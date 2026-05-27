import { useEffect } from "react";
import { html } from "htm/react";

export function PurgeModal({ count, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return html`
    <div className="modal-veil" onMouseDown=${(e) => { if (e.target.classList.contains("modal-veil")) onClose(); }}>
      <div className="modal" style=${{ width: "min(520px, 100%)" }}>
        <div className="modal-head">
          <div className="tag" style=${{ borderColor: "var(--red)", color: "var(--red)" }}>WARN</div>
          <h3 style=${{ color: "var(--red)" }}>&gt; <span style=${{ letterSpacing: "0.22em" }}>PURGE_ALL :: IRREVERSIBLE</span></h3>
          <button className="ctrl-btn" onClick=${onClose}>✕ ESC</button>
        </div>

        <div style=${{ padding: "28px 28px 20px 28px", display: "grid", gap: 18 }}>
          <div style=${{
            border: "1px solid rgba(255,51,85,0.45)",
            background: "rgba(255,51,85,0.06)",
            padding: "14px 16px",
            display: "grid",
            gap: 8,
          }}>
            <div style=${{ color: "var(--red)", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12 }}>
              ⚠ &nbsp;WARNING: DESTRUCTIVE OPERATION
            </div>
            <div style=${{ color: "var(--txt)", fontSize: 12.5, lineHeight: 1.65 }}>
              This will permanently delete <span style=${{ color: "var(--red)", fontWeight: 700 }}>${count} record${count !== 1 ? "s" : ""}</span> from the database.
              All profile data, contacts, relationships, and embedded images will be erased from local storage.
            </div>
            <div style=${{ color: "var(--dim)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              // this action cannot be undone
            </div>
          </div>

          <div style=${{ color: "var(--dim)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Confirm you wish to proceed:
          </div>
        </div>

        <div className="modal-foot">
          <div className="foot-hint" style=${{ color: "var(--red)", letterSpacing: "0.14em" }}>
            ${count} record${count !== 1 ? "s" : ""} will be deleted
          </div>
          <div className="foot-actions">
            <button className="ctrl-btn" onClick=${onClose}>↩ ABORT</button>
            <button
              className="ctrl-btn danger"
              style=${{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", boxShadow: "0 0 14px rgba(255,51,85,0.4)" }}
              onClick=${onConfirm}
            >⚠ CONFIRM PURGE</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
