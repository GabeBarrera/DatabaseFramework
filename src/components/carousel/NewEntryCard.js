import { html } from "htm/react";

export function NewEntryCard({ isCenter, onClick }) {
  let cls = "card new";
  if (isCenter) cls += " center";
  return html`
    <div className=${cls} onClick=${onClick} role="button" tabIndex=${0}
         onKeyDown=${(e) => e.key === "Enter" && onClick && onClick()}>
      <div className="new-inner">
        <div className="plus">+</div>
        <div className="label">New Entry</div>
        <div className="sub">[ append to .db ]</div>
      </div>
    </div>
  `;
}
