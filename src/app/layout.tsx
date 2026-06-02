import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import "@/styles.css";

export const metadata: Metadata = {
  title: "Applied.dev",
  description: "Track the jobs you've applied to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
