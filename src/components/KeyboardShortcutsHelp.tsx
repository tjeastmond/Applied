"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  appKeyboardShortcuts,
  isEditableKeyboardTarget,
  isShortcutsHelpOpenShortcut,
  type KeyboardShortcutContext,
} from "@/lib/keyboardShortcut";
import { cn } from "@/lib/utils";
import { KeyboardIcon, XIcon } from "lucide-react";

const KBD_CLASS =
  "bg-muted text-muted-foreground pointer-events-none shrink-0 rounded px-2 py-1 font-sans text-xs font-medium tracking-wider";

const SECTIONS: KeyboardShortcutContext[] = ["Global", "Detail Drawer"];

const BUBBLE_FILL = "border-[#333333] bg-[#333333] text-white";

const POP_IN_DURATION_MS = 450;

export function KeyboardShortcutsHelp({ detailDrawerActive = false }: { detailDrawerActive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [popIn, setPopIn] = useState(false);
  const detailDrawerActiveRef = useRef(detailDrawerActive);
  const shortcuts = appKeyboardShortcuts();

  useEffect(() => {
    const wasActive = detailDrawerActiveRef.current;
    detailDrawerActiveRef.current = detailDrawerActive;

    if (detailDrawerActive) {
      setOpen(false);
      setPopIn(false);
      return;
    }

    if (wasActive) {
      setPopIn(true);
      const timer = window.setTimeout(() => setPopIn(false), POP_IN_DURATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [detailDrawerActive]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (detailDrawerActive) return;

      if (open && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }

      if (!isShortcutsHelpOpenShortcut(event) || isEditableKeyboardTarget(event.target)) return;

      event.preventDefault();
      setOpen((prev) => !prev);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [detailDrawerActive, open]);

  const bubbleHidden = detailDrawerActive;
  const bubbleEntering = popIn && !detailDrawerActive;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[59] bg-transparent" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      {open ? (
        <div
          className="bg-card text-card-foreground ring-foreground/10 fixed right-4 bottom-16 z-[60] w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl shadow-sm ring-1 shadow-black/5 dark:shadow-black/40 dark:ring-white/6"
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <div className="border-border/40 flex items-center justify-between gap-3 border-b px-6 py-4">
            <h2 className="text-base font-bold tracking-tight">Keyboard Shortcuts</h2>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
              <XIcon />
            </Button>
          </div>
          <div className="space-y-6 px-6 py-5">
            {SECTIONS.map((section) => (
              <div key={section} className="space-y-3">
                <h3 className="text-muted-foreground text-sm font-bold tracking-wide uppercase">{section}</h3>
                <ul className="space-y-3">
                  {shortcuts
                    .filter((entry) => entry.context === section)
                    .map((entry) => (
                      <li
                        key={`${section}-${entry.keys}`}
                        className="flex items-start justify-between gap-4 text-sm leading-relaxed"
                      >
                        <span className="text-muted-foreground min-w-0 flex-1">{entry.description}</span>
                        <kbd className={KBD_CLASS}>{entry.keys}</kbd>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "text-foreground fixed right-4 bottom-4 z-[60] h-10 w-10 rounded-full border bg-transparent p-0 shadow-none",
          "border-[#333333] hover:border-[#333333] hover:bg-[#333333] hover:text-white",
          bubbleHidden &&
            "pointer-events-none translate-y-2 scale-75 opacity-0 transition-[transform,opacity] duration-300 ease-out motion-reduce:scale-100 motion-reduce:transition-none",
          bubbleEntering &&
            "animate-in fade-in-0 zoom-in-50 slide-in-from-bottom-4 duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:animate-none",
          !bubbleHidden &&
            !bubbleEntering &&
            "transition-[transform,opacity,background-color,border-color,color] duration-300 ease-out motion-reduce:transition-none",
          open && BUBBLE_FILL,
        )}
        aria-hidden={bubbleHidden}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        title="Keyboard Shortcuts"
        onClick={(event) => {
          setOpen((prev) => !prev);
          event.currentTarget.blur();
        }}
      >
        <KeyboardIcon className="size-3.5" strokeWidth={1.5} />
      </Button>
    </>
  );
}
