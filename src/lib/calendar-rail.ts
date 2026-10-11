/**
 * The calendar rail's order (10.1): tasks with nothing upcoming first, in the order given (list
 * order), then scheduled ones by their next slot. Stable. Shared by listCalendarTasks and the
 * rail's optimistic updates, so a dropped task moves to its final place at once instead of
 * jumping there when the refetch lands (possibly under the pointer of the next drag).
 */
export function orderRailTasks<T extends { nextBlockStart: string | null }>(tasks: T[]): T[] {
  const free = tasks.filter((t) => !t.nextBlockStart);
  const booked = tasks.filter((t) => t.nextBlockStart).sort((a, b) => a.nextBlockStart!.localeCompare(b.nextBlockStart!));
  return [...free, ...booked];
}
