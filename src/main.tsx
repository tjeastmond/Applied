import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { Toaster } from "@/components/ui/sonner";
import "@/styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
);
