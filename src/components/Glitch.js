import { html } from "htm/react";

export function Glitch({ children, className = "" }) {
  return html`<span className=${"glitch " + className} data-text=${children}>${children}</span>`;
}
