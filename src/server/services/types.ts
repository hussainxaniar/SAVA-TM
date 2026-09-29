import type { SpaceRole } from "@prisma/client";

// Section 8: every service takes `ctx` first.
export type Ctx = { userId: string };

export type SpaceSummaryDTO = { id: string; name: string; icon: string | null; role: SpaceRole };
