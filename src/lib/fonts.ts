import localFont from "next/font/local";

/** Self-hosted Roboto Mono (latin, variable wght). `display: block` avoids swap flicker. */
export const robotoMono = localFont({
  src: "../fonts/roboto-mono-latin.woff2",
  display: "block",
  preload: true,
  variable: "--font-app",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    "monospace",
  ],
});
