export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function modKeyLabel(key: string): string {
  return isMacPlatform() ? `⌘${key}` : `Ctrl+${key}`;
}

function modKeyDescription(key: string, action: string): string {
  const modifier = isMacPlatform() ? "Command" : "Ctrl";
  return `${modifier}+${key} ${action}`;
}

function hasNoModKeys(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isUnmodifiedKey(event: KeyboardEvent, key: string, allowShift = false): boolean {
  if (event.key !== key || !hasNoModKeys(event)) return false;
  return allowShift || !event.shiftKey;
}

export function modKShortcutLabel(): string {
  return modKeyLabel("K");
}

export function modKShortcutDescription(): string {
  return modKeyDescription("K", "opens the new application modal");
}

export function modSShortcutLabel(): string {
  return modKeyLabel("S");
}

export function modSShortcutDescription(): string {
  return modKeyDescription("S", "saves application changes");
}

export function modEnterShortcutLabel(): string {
  return isMacPlatform() ? "⌘↵" : "Ctrl+↵";
}

export function modEnterShortcutDescription(): string {
  return modKeyDescription("Enter", "adds the note");
}

export function isModKeyChord(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() !== key.toLowerCase()) return false;
  return event.metaKey || event.ctrlKey;
}

export function isSearchFocusSlash(event: KeyboardEvent): boolean {
  return isUnmodifiedKey(event, "/");
}

export function isAdminOpenShortcut(event: KeyboardEvent): boolean {
  return isUnmodifiedKey(event, "a");
}

export function isShortcutsHelpOpenShortcut(event: KeyboardEvent): boolean {
  return isUnmodifiedKey(event, "?", true);
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Max ms between two Escape presses to count as a double-tap. */
export const DOUBLE_ESCAPE_INTERVAL_MS = 400;

export function consumeDoubleEscape(
  event: KeyboardEvent,
  lastPressAtRef: { current: number | null },
  now: number = Date.now(),
): boolean {
  if (event.key !== "Escape" || event.repeat) return false;
  const last = lastPressAtRef.current;
  lastPressAtRef.current = now;
  if (last !== null && now - last <= DOUBLE_ESCAPE_INTERVAL_MS) {
    lastPressAtRef.current = null;
    return true;
  }
  return false;
}

export type KeyboardShortcutContext = "Global" | "Detail Drawer";

export type KeyboardShortcutEntry = {
  keys: string;
  description: string;
  context: KeyboardShortcutContext;
};

export function appKeyboardShortcuts(): KeyboardShortcutEntry[] {
  return [
    {
      keys: modKeyLabel("k"),
      description: modKShortcutDescription(),
      context: "Global",
    },
    {
      keys: "/",
      description: "Focus search",
      context: "Global",
    },
    {
      keys: "Esc Esc",
      description: "Clear filters",
      context: "Global",
    },
    {
      keys: "a",
      description: "Open admin/settings",
      context: "Global",
    },
    {
      keys: "?",
      description: "Open keyboard shortcuts",
      context: "Global",
    },
    {
      keys: "↑ / ↓",
      description: "Navigate application cards",
      context: "Global",
    },
    {
      keys: "Enter",
      description: "Open selected application",
      context: "Global",
    },
    {
      keys: modKeyLabel("s"),
      description: modSShortcutDescription(),
      context: "Detail Drawer",
    },
    {
      keys: modEnterShortcutLabel(),
      description: modEnterShortcutDescription(),
      context: "Detail Drawer",
    },
    {
      keys: "Esc",
      description: "Cancel note edit",
      context: "Detail Drawer",
    },
  ];
}
