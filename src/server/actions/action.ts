import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { getSessionUser } from "../auth";
import { AppError } from "../errors";
import type { Ctx } from "../services/types";

// Section 4: every server action is `action(schema, handler)`, so session lookup, input
// parsing and error mapping are identical everywhere. Not a "use server" file itself;
// the files in this folder that export actions are.

export type ActionError = { code: AppError["code"] | "INTERNAL"; message: string };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function action<S extends z.ZodTypeAny, T>(
  schema: S,
  handler: (input: z.output<S>, ctx: Ctx) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (raw) => {
    try {
      const user = await getSessionUser();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Invalid input" } };
      }
      return { ok: true, data: await handler(parsed.data, { userId: user.id }) };
    } catch (e) {
      unstable_rethrow(e); // let redirect()/notFound() through
      if (e instanceof AppError) return { ok: false, error: { code: e.code, message: e.message } };
      console.error(e);
      return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Try again." } };
    }
  };
}
