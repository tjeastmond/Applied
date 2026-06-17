"use client";

import { loginApp } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export function LoginDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
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
      onOpenChange(false);
      toast.success(toastMessages.loginSuccess);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.loginFailed));
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, onAuthenticated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Enter your app access token to use APPLIED. Set APP_ACCESS_TOKEN in your environment and run{" "}
            <code className="text-xs">pnpm app:token</code> to generate one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="app-access-token">Access Token</Label>
          <Input
            id="app-access-token"
            type="password"
            autoComplete="off"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Paste your access token"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="cancelOutline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Sign In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
