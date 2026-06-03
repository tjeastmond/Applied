export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

export function modKShortcutLabel(): string {
  return isMacPlatform() ? "⌘K" : "Ctrl+K";
}

export function modKShortcutDescription(): string {
  const modifier = isMacPlatform() ? "Command" : "Ctrl";
  return `${modifier}+K opens the new application modal`;
}

export function modSShortcutLabel(): string {
  return isMacPlatform() ? "⌘S" : "Ctrl+S";
}

export function modSShortcutDescription(): string {
  const modifier = isMacPlatform() ? "Command" : "Ctrl";
  return `${modifier}+S saves application changes`;
}

export function modEnterShortcutLabel(): string {
  return isMacPlatform() ? "⌘↵" : "Ctrl+↵";
}

export function modEnterShortcutDescription(): string {
  const modifier = isMacPlatform() ? "Command" : "Ctrl";
  return `${modifier}+Enter adds the note`;
}

export function isModKeyChord(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() !== key.toLowerCase()) return false;
  return event.metaKey || event.ctrlKey;
}

export function isSearchFocusSlash(event: KeyboardEvent): boolean {
  if (event.key !== "/") return false;
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
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
