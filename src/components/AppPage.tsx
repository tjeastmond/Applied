"use client";

import { logoutApp } from "@/api";
import { AuthenticatedApp } from "@/components/AuthenticatedApp";
import { LoginGate } from "@/components/login/LoginGate";
import { errorMessage } from "@/lib/errorMessage";
import { setUnauthorizedHandler } from "@/lib/apiUnauthorized";
import { toastMessages } from "@/lib/toastMessages";
import type { AuthStatus } from "@/lib/authTypes";
import type { ApplicationNote, JobApplication } from "@/types";
import type { ApplicationPageSize } from "@/lib/applicationPagination";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AppPageProps = {
  initialApplications: JobApplication[];
  initialNotesByApplicationId: Record<string, ApplicationNote[]>;
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  tursoSyncAvailable: boolean;
  authStatus: AuthStatus;
};

export function AppPage(props: AppPageProps) {
  const router = useRouter();
  const loginMode = props.authStatus.devQuickLoginAvailable ? "dev-quick" : "token-paste";
  const [sessionActive, setSessionActive] = useState(props.authStatus.authenticated);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  useEffect(() => {
    if (isBootstrapping) {
      if (props.authStatus.authenticated) {
        setIsBootstrapping(false);
        setSessionActive(true);
      }
      return;
    }

    if (props.authStatus.authenticated) {
      setSessionActive(true);
    } else {
      setSessionActive(false);
    }
  }, [props.authStatus.authenticated, isBootstrapping]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsBootstrapping(false);
      setSessionActive(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const handleAuthenticated = useCallback(() => {
    setIsBootstrapping(true);
    router.refresh();
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutApp();
      setIsBootstrapping(false);
      setSessionActive(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.logoutFailed));
    }
  }, [router]);

  if (!sessionActive) {
    return <LoginGate mode={loginMode} onAuthenticated={handleAuthenticated} isLoading={isBootstrapping} />;
  }

  return <AuthenticatedApp {...props} onLogout={() => void handleLogout()} />;
}
