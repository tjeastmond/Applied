/** True when the OS typically uses ⌘ (Meta) for primary shortcuts. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

/** Label for the primary modifier + K chord (e.g. ⌘K or Ctrl+K). */
export function modKShortcutLabel(): string {
  return isMacPlatform() ? "⌘K" : "Ctrl+K";
}

/** Title/tooltip copy for the new-application shortcut. */
export function modKShortcutDescription(): string {
  return isMacPlatform()
    ? "Command K opens the new application modal"
    : "Ctrl+K opens the new application modal";
}

export function isModKeyChord(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() !== key.toLowerCase()) return false;
  return event.metaKey || event.ctrlKey;
}

/** Skip shortcuts while the user is typing in a field. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
