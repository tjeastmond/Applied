"use client";

import { updateCurrentUserProfile } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import type { User } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ProfilePageProps = {
  user: User;
  onUserUpdated: (user: User) => void;
  onCancel: () => void;
};

function profileFormFromUser(user: User) {
  return {
    displayName: user.displayName,
    email: user.email ?? "",
  };
}

function isProfileFormValid(displayName: string) {
  return displayName.trim().length > 0;
}

export function ProfilePage({ user, onUserUpdated, onCancel }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email ?? "");
  const [showValidation, setShowValidation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const form = profileFormFromUser(user);
    setDisplayName(form.displayName);
    setEmail(form.email);
    setShowValidation(false);
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!isProfileFormValid(displayName)) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await updateCurrentUserProfile({
        displayName: displayName.trim(),
        email: email.trim().length > 0 ? email.trim() : null,
      });
      onUserUpdated(updatedUser);
      toast.success(toastMessages.profileUpdated);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.profileUpdateFailed));
    } finally {
      setIsSaving(false);
    }
  }, [displayName, email, onUserUpdated]);

  const nameInvalid = showValidation && !isProfileFormValid(displayName);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">Update your name and email.</p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="profile-display-name">Name</Label>
          <Input
            id="profile-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-invalid={nameInvalid}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Profile"}
        </Button>
        <Button type="button" variant="cancelOutline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
