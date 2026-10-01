"use server";

import { addComment, deleteComment, editComment, getFeed } from "../services/comments";
import { action } from "./action";
import { addCommentSchema, commentSchema, editCommentSchema, feedSchema } from "./comments.schema";

// Comment and feed actions (Section 8.5). Like the task actions they don't call refresh(): the
// task dialog keeps the feed in TanStack Query (['task', taskId, 'feed']) with optimistic updates.

export const getFeedAction = action(feedSchema, (input, ctx) => getFeed(ctx, input));
/** Returns the new comment's FeedItemDTO. */
export const addCommentAction = action(addCommentSchema, (input, ctx) => addComment(ctx, input));
export const editCommentAction = action(editCommentSchema, (input, ctx) => editComment(ctx, input));
export const deleteCommentAction = action(commentSchema, (input, ctx) => deleteComment(ctx, input));
