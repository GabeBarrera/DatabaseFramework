import { useState, useEffect } from "react";
import { html } from "htm/react";
import { Glitch } from "./Glitch.js";

export function TopBar({ count }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const ts = time.toISOString().slice(0, 19).replace("T", " ");
  return html`
    <header className="topbar">
      <div className="title-wrap">
        <${Glitch}>PERSONA_DB // v0.1.1<//>
      </div>
      <div className="top-meta">
        <span><span className="dot" /> LINK_OK</span>
        <span>${count.toString().padStart(3, "0")} REC</span>
        <span>${ts} UTC</span>
      </div>
    </header>
  `;
}
