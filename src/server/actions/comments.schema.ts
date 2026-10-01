import { z } from "zod";

const id = z.string().min(1);
/** Tiptap JSON; the service checks size and that it has some text. */
const body = z.object({ type: z.literal("doc") }).passthrough();

export const addCommentSchema = z.object({ taskId: id, body });
export const editCommentSchema = z.object({ commentId: id, body });
export const commentSchema = z.object({ commentId: id });
export const feedSchema = z.object({ taskId: id, filter: z.enum(["all", "comments"]).optional() });
