import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { robotoMono } from "@/lib/fonts";
import { themeInitScript } from "@/lib/theme";
import type { Metadata } from "next";
import "@/styles.css";

export const metadata: Metadata = {
  title: "APPLIED.",
  description: "Job application tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={robotoMono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className={`${robotoMono.className} min-h-screen antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
