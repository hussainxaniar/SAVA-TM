"use client";

import { createContext, useContext } from "react";
import type { UserLite } from "@/server/services/types";

/*
 * The current space's members (id, name, image), loaded once by the space layout. Components that
 * need them for a picker (a list row's quick "add assignee", Section 9.2) read them here instead of
 * threading a prop through every level. Empty outside a space layout.
 */

const SpaceMembersContext = createContext<UserLite[]>([]);

export function SpaceMembersProvider({ members, children }: { members: UserLite[]; children: React.ReactNode }) {
  return <SpaceMembersContext.Provider value={members}>{children}</SpaceMembersContext.Provider>;
}

export function useSpaceMembers(): UserLite[] {
  return useContext(SpaceMembersContext);
}
