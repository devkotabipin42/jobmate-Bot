import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

const loader = document.getElementById("initial-loader");
if (loader) {
  loader.style.opacity = "0";
  loader.style.transition = "opacity 220ms ease";
  window.setTimeout(() => loader.remove(), 240);
}
