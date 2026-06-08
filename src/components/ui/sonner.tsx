"use client";

import { useTheme } from "@/components/ThemeProvider";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="top-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-green-700 dark:text-green-400" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-700 dark:text-amber-400" />,
        error: <OctagonXIcon className="size-4 text-red-700 dark:text-red-400" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group toast border shadow-md",
          success:
            "!border-green-600 !bg-green-50 !text-green-800 dark:!border-green-700 dark:!bg-green-950 dark:!text-green-200",
          error: "!border-red-600 !bg-red-100 !text-red-900 dark:!border-red-700 dark:!bg-red-950 dark:!text-red-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
