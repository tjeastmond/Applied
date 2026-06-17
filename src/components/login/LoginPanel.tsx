"use client";

import { devLoginApp, loginApp } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export type LoginPanelMode = "dev-quick" | "token-paste";

export function LoginPanel({
  mode,
  onAuthenticated,
  isLoading = false,
}: {
  mode: LoginPanelMode;
  onAuthenticated: () => void;
  isLoading?: boolean;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showLoading = isLoading || isSubmitting;

  const handleDevLogin = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await devLoginApp();
      onAuthenticated();
    } catch (error) {
      setIsSubmitting(false);
      toast.error(errorMessage(error, toastMessages.loginFailed));
    }
  }, [onAuthenticated]);

  const handleTokenSubmit = useCallback(async () => {
    const trimmed = accessToken.trim();
    if (!trimmed) {
      toast.error(toastMessages.loginTokenRequired);
      return;
    }

    setIsSubmitting(true);
    try {
      await loginApp(trimmed);
      setAccessToken("");
      onAuthenticated();
    } catch (error) {
      setIsSubmitting(false);
      toast.error(errorMessage(error, toastMessages.loginFailed));
    }
  }, [accessToken, onAuthenticated]);

  if (mode === "dev-quick") {
    return (
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-base font-medium">Local Development</h1>
          <p className="text-muted-foreground text-sm">
            {showLoading ? "Loading your applications…" : "Click below to log in and start using APPLIED."}
          </p>
        </div>
        <Button type="button" className="w-full" onClick={() => void handleDevLogin()} disabled={showLoading}>
          {showLoading ? "Loading…" : "Log In"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <h1 className="text-base font-medium">Sign In</h1>
        <p className="text-muted-foreground text-sm">
          {showLoading
            ? "Loading your applications…"
            : "Enter your app access token to use APPLIED. Set APP_ACCESS_TOKEN in your environment if you have not already."}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="app-access-token">Access Token</Label>
        <Input
          id="app-access-token"
          type="password"
          autoComplete="off"
          value={accessToken}
          disabled={showLoading}
          onChange={(event) => setAccessToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleTokenSubmit();
            }
          }}
          placeholder="Paste your access token"
        />
      </div>
      <Button type="button" className="w-full" onClick={() => void handleTokenSubmit()} disabled={showLoading}>
        {showLoading ? "Loading…" : "Sign In"}
      </Button>
    </div>
  );
}
