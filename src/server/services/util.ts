import { AppError } from "../errors";

/** Trims a user-entered name and enforces 1..max characters. */
export function cleanName(value: string, label: string, max = 80): string {
  const name = value.trim();
  if (!name) throw new AppError("VALIDATION", `${label} can't be empty`);
  if (name.length > max) throw new AppError("VALIDATION", `${label} must be at most ${max} characters`);
  return name;
}
