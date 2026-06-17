"use client";

import { LoginPanel, type LoginPanelMode } from "@/components/login/LoginPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent } from "@/components/ui/card";

export function LoginGate({
  mode,
  onAuthenticated,
  isLoading = false,
}: {
  mode: LoginPanelMode;
  onAuthenticated: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <p className="mb-8 text-3xl font-bold tracking-tight">APPLIED.</p>
      <Card className="w-full max-w-md shadow-sm shadow-black/5">
        <CardContent className="pt-6">
          <LoginPanel mode={mode} onAuthenticated={onAuthenticated} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
