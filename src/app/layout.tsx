import { Toaster } from "@/components/ui/sonner";
import { robotoMono } from "@/lib/fonts";
import type { Metadata } from "next";
import "@/styles.css";

export const metadata: Metadata = {
  title: "Applied.dev",
  description: "Job application tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={robotoMono.variable}>
      <body className={`${robotoMono.className} min-h-screen antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
