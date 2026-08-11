"use client";

import { AddApplicationDialog } from "@/components/AddApplicationDialog";
import { ApplicationDetailSheet } from "@/components/ApplicationDetailSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AuthenticatedAppController } from "@/hooks/useAuthenticatedAppController";

type AuthenticatedAppOverlaysProps = Pick<
  AuthenticatedAppController,
  | "formOpen"
  | "setFormOpen"
  | "selectedApplication"
  | "detailOpen"
  | "selectedNotes"
  | "selectedNotesLoading"
  | "selectedStatusHistory"
  | "selectedStatusHistoryLoading"
  | "handleNotesChange"
  | "handleDetailOpenChange"
  | "handleDetailCloseComplete"
  | "handleApplicationChange"
  | "handleStatusChange"
  | "requestDelete"
  | "pendingDeleteId"
  | "pendingDeleteApplication"
  | "isDeleting"
  | "handleDeleteDialogOpenChange"
  | "confirmDelete"
>;

export function AuthenticatedAppOverlays({
  formOpen,
  setFormOpen,
  selectedApplication,
  detailOpen,
  selectedNotes,
  selectedNotesLoading,
  selectedStatusHistory,
  selectedStatusHistoryLoading,
  handleNotesChange,
  handleDetailOpenChange,
  handleDetailCloseComplete,
  handleApplicationChange,
  handleStatusChange,
  requestDelete,
  pendingDeleteId,
  pendingDeleteApplication,
  isDeleting,
  handleDeleteDialogOpenChange,
  confirmDelete,
}: AuthenticatedAppOverlaysProps) {
  return (
    <>
      <AddApplicationDialog open={formOpen} onOpenChange={setFormOpen} onApplicationCreated={handleApplicationChange} />

      <ApplicationDetailSheet
        application={selectedApplication}
        open={detailOpen}
        notes={selectedNotes}
        notesLoading={selectedNotesLoading}
        statusHistory={selectedStatusHistory}
        statusHistoryLoading={selectedStatusHistoryLoading}
        onNotesChange={handleNotesChange}
        onOpenChange={handleDetailOpenChange}
        onCloseComplete={handleDetailCloseComplete}
        onApplicationChange={handleApplicationChange}
        onStatusChange={handleStatusChange}
        onRequestDelete={requestDelete}
      />

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteApplication
                ? `This will permanently remove "${pendingDeleteApplication.title || pendingDeleteApplication.url}". This action cannot be undone.`
                : "This will permanently remove this application. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} variant="cancelOutline">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} variant="destructiveSolid" onClick={() => void confirmDelete()}>
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
