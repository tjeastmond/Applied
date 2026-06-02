export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

export function modKShortcutLabel(): string {
  return isMacPlatform() ? "⌘K" : "Ctrl+K";
}

export function modKShortcutDescription(): string {
  return isMacPlatform()
    ? "Command K opens the new application modal"
    : "Ctrl+K opens the new application modal";
}

export function isModKeyChord(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() !== key.toLowerCase()) return false;
  return event.metaKey || event.ctrlKey;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
