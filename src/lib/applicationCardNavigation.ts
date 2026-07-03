import { isEditableKeyboardTarget } from "@/lib/keyboardShortcut";

export type CardNavigationDirection = "up" | "down";

export type CardNavigationKey = CardNavigationDirection | "enter";

/** Index math for moving among visible cards (no wrap at edges). */
export function stepCardIndex(currentIndex: number, direction: CardNavigationDirection, count: number): number {
  if (count <= 0) return -1;
  if (currentIndex === -1) {
    return direction === "down" ? 0 : -1;
  }
  if (direction === "down") {
    return Math.min(currentIndex + 1, count - 1);
  }
  return Math.max(currentIndex - 1, 0);
}

export function resolveNextCardId(
  visibleIds: readonly string[],
  currentId: string | null,
  direction: CardNavigationDirection,
  seedId: string | null = null,
): string | null {
  if (visibleIds.length === 0) return null;
  const effectiveId = currentId ?? seedId;
  const currentIndex = effectiveId ? visibleIds.indexOf(effectiveId) : -1;
  const nextIndex = stepCardIndex(currentIndex, direction, visibleIds.length);
  if (nextIndex === -1) return null;
  return visibleIds[nextIndex] ?? null;
}

export function cardNavigationKeyFromEvent(event: Pick<KeyboardEvent, "key">): CardNavigationKey | null {
  switch (event.key) {
    case "ArrowDown":
      return "down";
    case "ArrowUp":
      return "up";
    case "Enter":
      return "enter";
    default:
      return null;
  }
}

export type ApplicationCardNavigationContext = {
  formOpen: boolean;
  detailOpen: boolean;
  pendingDeleteId: string | null;
  visibleCardCount: number;
  target: EventTarget | null;
};

export function canHandleApplicationCardNavigation(ctx: ApplicationCardNavigationContext): boolean {
  if (ctx.formOpen || ctx.detailOpen || ctx.pendingDeleteId !== null) return false;
  if (ctx.visibleCardCount === 0) return false;
  return !isEditableKeyboardTarget(ctx.target);
}
