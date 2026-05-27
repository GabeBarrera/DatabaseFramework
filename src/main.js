import { createRoot } from "react-dom/client";
import { html } from "htm/react";
import { App } from "./App.js";

createRoot(document.getElementById("root")).render(html`<${App} />`);
