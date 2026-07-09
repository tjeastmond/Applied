import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { robotoMono } from "@/lib/fonts";
import { applicationPageSizeInitScript } from "@/lib/applicationPagination";
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
        <script dangerouslySetInnerHTML={{ __html: `${themeInitScript()}${applicationPageSizeInitScript()}` }} />
      </head>
      <body className={`${robotoMono.className} min-h-screen antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
