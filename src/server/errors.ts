export class AppError extends Error {
  constructor(
    public code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "VALIDATION"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}
