"use client";

import { devLoginApp, loginApp, passwordLoginApp, setupApp } from "@/api";
import { resolveLoginPanelLayout } from "@/lib/loginPanelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export function LoginPanel({
  setupRequired,
  devQuickLoginAvailable,
  onAuthenticated,
  isLoading = false,
}: {
  setupRequired: boolean;
  devQuickLoginAvailable: boolean;
  onAuthenticated: () => void;
  isLoading?: boolean;
}) {
  const layout = resolveLoginPanelLayout(setupRequired, devQuickLoginAvailable);
  const isCreateAccount = layout.primaryMode === "create-account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const showLoading = isLoading || isSubmitting;

  const handleCredentialSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    const trimmedDisplayName = displayName.trim();

    if (isCreateAccount && trimmedDisplayName.length === 0) {
      setShowValidation(true);
      toast.error(toastMessages.loginNameRequired);
      return;
    }

    if (!trimmedEmail) {
      setShowValidation(true);
      toast.error(toastMessages.loginEmailRequired);
      return;
    }

    if (!trimmedPassword) {
      setShowValidation(true);
      toast.error(toastMessages.loginPasswordRequired);
      return;
    }

    if (isCreateAccount) {
      if (trimmedPassword !== confirmPassword) {
        toast.error(toastMessages.loginPasswordMismatch);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isCreateAccount) {
        await setupApp({
          email: trimmedEmail,
          password: trimmedPassword,
          displayName: trimmedDisplayName,
        });
      } else {
        await passwordLoginApp({ email: trimmedEmail, password: trimmedPassword });
      }
      setPassword("");
      setConfirmPassword("");
      onAuthenticated();
    } catch (error) {
      setIsSubmitting(false);
      toast.error(errorMessage(error, toastMessages.loginFailed));
    }
  }, [confirmPassword, displayName, email, isCreateAccount, onAuthenticated, password]);

  const nameInvalid = showValidation && isCreateAccount && displayName.trim().length === 0;

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

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <h1 className="text-base font-medium">{isCreateAccount ? "Create Account" : "Sign In"}</h1>
        {showLoading || !isCreateAccount ? (
          <p className="text-muted-foreground text-sm">
            {showLoading ? "Loading your applications…" : "Sign in with your email and password."}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {isCreateAccount ? (
          <div className="grid gap-2">
            <Label htmlFor="login-display-name">Name</Label>
            <Input
              id="login-display-name"
              type="text"
              autoComplete="name"
              value={displayName}
              disabled={showLoading}
              onChange={(event) => setDisplayName(event.target.value)}
              aria-invalid={nameInvalid}
              placeholder="Your name"
            />
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            disabled={showLoading}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete={isCreateAccount ? "new-password" : "current-password"}
            value={password}
            disabled={showLoading}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isCreateAccount) {
                event.preventDefault();
                void handleCredentialSubmit();
              }
            }}
            placeholder={isCreateAccount ? "At least 10 characters" : "Your password"}
          />
        </div>

        {isCreateAccount ? (
          <div className="grid gap-2">
            <Label htmlFor="login-confirm-password">Confirm Password</Label>
            <Input
              id="login-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={showLoading}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCredentialSubmit();
                }
              }}
              placeholder="Re-enter your password"
            />
          </div>
        ) : null}
      </div>

      <Button type="button" className="w-full" onClick={() => void handleCredentialSubmit()} disabled={showLoading}>
        {showLoading ? "Loading…" : isCreateAccount ? "Create Account" : "Sign In"}
      </Button>

      <Separator />

      {layout.showDevQuickLogin ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-center text-sm">Or skip account setup in local development.</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void handleDevLogin()}
            disabled={showLoading}
          >
            {showLoading ? "Loading…" : "Log In"}
          </Button>
        </div>
      ) : null}

      {layout.showTokenPaste ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-center text-sm">
            Or sign in with your app access token. Set APP_ACCESS_TOKEN in your environment if you have not already.
          </p>
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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void handleTokenSubmit()}
            disabled={showLoading}
          >
            {showLoading ? "Loading…" : "Sign In With Token"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
