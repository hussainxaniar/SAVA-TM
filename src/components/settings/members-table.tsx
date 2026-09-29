"use client";

import type { MemberDTO } from "@/server/services/types";

/** A member plus what the viewer may do to them (decided on the server from Section 7.3). */
export type MemberRow = MemberDTO & { isViewer: boolean; canChangeRole: boolean; canRemove: boolean };

// TODO (T-05, implementer): see docs/tickets/T-05.md
export function MembersTable(_props: { spaceId: string; members: MemberRow[] }) {
  return null;
}
