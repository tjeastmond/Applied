import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-green-700" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-700" />,
        error: <OctagonXIcon className="size-4 text-red-700" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group toast border shadow-md",
          success: "!border-green-600 !bg-green-50 !text-green-800",
          error: "!border-red-600 !bg-red-100 !text-red-900",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
