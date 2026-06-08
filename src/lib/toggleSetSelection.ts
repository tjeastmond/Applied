export function toggleSetSelection<T>(selected: Set<T>, value: T, checked: boolean): Set<T> {
  const next = new Set(selected);
  if (checked) next.add(value);
  else next.delete(value);
  return next;
}
