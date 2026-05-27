import { html } from "htm/react";
import { FIELDS } from "../constants/fields.js";

export function SearchStrip({ query, setQuery, field, setField, filtered, total }) {
  return html`
    <div className="search-strip">
      <div className="input-wrap">
        <span className="pfx">grep -i</span>
        <input
          value=${query}
          onChange=${(e) => setQuery(e.target.value)}
          placeholder="filter cards by name, address, notes, contacts, relationships…"
        />
        ${query && html`<span style=${{ cursor: "pointer", color: "var(--grn-3)" }} onClick=${() => setQuery("")}>✕</span>`}
      </div>
      <div className="strip-chips">
        ${FIELDS.map((f) => html`
          <button
            key=${f.id}
            className=${"chip " + (field === f.id ? "on" : "")}
            onClick=${() => setField(f.id)}
          >${f.label}</button>
        `)}
      </div>
      <div className="match-pill">
        MATCHES <b>${filtered.toString().padStart(2, "0")}</b> / ${total.toString().padStart(2, "0")}
        ${(query || field !== "all") && html`
          <span className="clr" onClick=${() => { setQuery(""); setField("all"); }} title="clear filter">✕</span>
        `}
      </div>
    </div>
  `;
}
