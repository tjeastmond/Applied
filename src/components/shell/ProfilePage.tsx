"use client";

import { changeCurrentUserPassword, getCurrentUserProfile, updateCurrentUserProfile } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

function isNewPasswordValid(password: string) {
  return password.length >= 10 && password.length <= 256;
}

export function ProfilePage({ user, onUserUpdated, onCancel }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email ?? "");
  const [showValidation, setShowValidation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPasswordLogin, setHasPasswordLogin] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const form = profileFormFromUser(user);
    setDisplayName(form.displayName);
    setEmail(form.email);
    setShowValidation(false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    void getCurrentUserProfile()
      .then((profile) => {
        if (!cancelled) {
          setHasPasswordLogin(profile.hasPasswordLogin);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasPasswordLogin(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleChangePassword = useCallback(async () => {
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmNewPassword.trim();

    if (!trimmedCurrent) {
      setShowPasswordValidation(true);
      toast.error(toastMessages.changePasswordCurrentRequired);
      return;
    }

    if (!trimmedNew) {
      setShowPasswordValidation(true);
      toast.error(toastMessages.changePasswordNewRequired);
      return;
    }

    if (!isNewPasswordValid(trimmedNew)) {
      setShowPasswordValidation(true);
      toast.error("Password must be at least 10 characters.");
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setShowPasswordValidation(true);
      toast.error(toastMessages.changePasswordMismatch);
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeCurrentUserPassword({
        currentPassword: trimmedCurrent,
        newPassword: trimmedNew,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordValidation(false);
      toast.success(toastMessages.passwordChanged);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.passwordChangeFailed));
    } finally {
      setIsChangingPassword(false);
    }
  }, [confirmNewPassword, currentPassword, newPassword]);

  const nameInvalid = showValidation && !isProfileFormValid(displayName);
  const currentPasswordInvalid = showPasswordValidation && currentPassword.trim().length === 0;
  const newPasswordInvalid =
    showPasswordValidation && (newPassword.trim().length === 0 || !isNewPasswordValid(newPassword.trim()));
  const confirmPasswordInvalid =
    showPasswordValidation &&
    (confirmNewPassword.trim().length === 0 || confirmNewPassword.trim() !== newPassword.trim());

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
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving || isChangingPassword}>
          {isSaving ? "Saving…" : "Save Profile"}
        </Button>
        <Button type="button" variant="cancelOutline" onClick={onCancel} disabled={isSaving || isChangingPassword}>
          Cancel
        </Button>
      </div>

      {hasPasswordLogin ? (
        <>
          <Separator className="my-8" />
          <div className="mb-8">
            <h2 className="text-base font-semibold tracking-tight">Change Password</h2>
            <p className="text-muted-foreground mt-1 text-sm">Update your sign-in password.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="profile-current-password">Current Password</Label>
              <Input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                aria-invalid={currentPasswordInvalid}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">New Password</Label>
              <Input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                aria-invalid={newPasswordInvalid}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-new-password">Confirm New Password</Label>
              <Input
                id="profile-confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                aria-invalid={confirmPasswordInvalid}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="mt-8">
            <Button type="button" onClick={() => void handleChangePassword()} disabled={isSaving || isChangingPassword}>
              {isChangingPassword ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
