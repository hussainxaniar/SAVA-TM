import type { ActivityType, SpaceRole } from "@prisma/client";

// Section 8: every service takes `ctx` first.
export type Ctx = { userId: string };

export type SpaceSummaryDTO = { id: string; name: string; icon: string | null; role: SpaceRole };

export type UserLite = { id: string; name: string; image: string | null };

export type MemberDTO = UserLite & { email: string; role: SpaceRole; joinedAt: string };

export type InviteRole = Exclude<SpaceRole, "OWNER">;

export type InviteStatus = "ACTIVE" | "EXPIRED" | "USED_UP";

/** Invites shown in Space settings (revoked ones are hidden). */
export type InviteDTO = {
  id: string;
  url: string;
  role: InviteRole;
  expiresAt: string;
  uses: number;
  maxUses: number | null;
  createdAt: string;
  status: InviteStatus;
};

export type InviteProblem = "NOT_FOUND" | "EXPIRED" | "REVOKED" | "USED_UP";

/**
 * What /invite/[token] shows. `memberSpaceId` is set only when the caller already belongs
 * to the space (7.2.4 → redirect); non-members never learn the space id.
 */
export type InviteInfoDTO =
  | { valid: true; spaceName: string; role: InviteRole; memberSpaceId: string | null }
  | { valid: false; reason: InviteProblem; spaceName: string | null; memberSpaceId: string | null };

/** Section 8.3 getSidebar. Archived projects, lists and docs are excluded; all in position order. */
export type SidebarDTO = {
  projects: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    /** openTaskCount: open, live tasks shown in the list (home or linked, any depth). */
    lists: { id: string; name: string; icon: string | null; openTaskCount: number }[];
    /** firstPageId: the doc's first root page, so the sidebar can link straight to it. */
    docs: { id: string; title: string; firstPageId: string | null }[];
  }[];
};

export type StatusCategoryName = "TODO" | "ACTIVE" | "DONE";

/** Section 8.1. */
export type StatusDTO = {
  id: string;
  name: string;
  color: string;
  category: StatusCategoryName;
  /** ACTIVE statuses: "circle" | "quarter" | "half" | "threeQuarter"; null = chosen by position. */
  icon: string | null;
  position: string;
};

/** Project settings (9.6): statuses and active lists, with how many live tasks each holds. */
export type ProjectSettingsDTO = {
  project: { id: string; spaceId: string; name: string; color: string; icon: string | null };
  statuses: (StatusDTO & { taskCount: number })[];
  lists: { id: string; name: string; icon: string | null; subtaskDisplay: "NESTED" | "SEPARATE"; taskCount: number }[];
};

// ---------- Tasks (Section 8.1 / 8.4) ----------

export type Priority = 1 | 2 | 3 | 4;

export type TaskRowDTO = {
  id: string;
  title: string;
  priority: Priority;
  status: StatusDTO;
  completedAt: string | null;
  startDate: string | null;
  dueDate: string | null;
  dueHasTime: boolean;
  assignees: UserLite[];
  parentId: string | null;
  parentTitle: string | null;
  depth: number;
  homeListId: string;
  /** Active lists the task is linked into (6.6), oldest link first; never includes homeListId. */
  linkedListIds: string[];
  /** True when the row is in this list only through a TaskListLink (6.6). */
  isLinkedHere: boolean;
  /** Direct, non-deleted subtasks. */
  subtaskCount: number;
  openSubtaskCount: number;
  commentCount: number;
  /** Home position, or the link's position when isLinkedHere. */
  position: string;
};

export type TaskDetailDTO = TaskRowDTO & {
  description: unknown | null; // Tiptap JSON
  projectId: string;
  spaceId: string;
  /** For the task dialog's breadcrumb and the Move to… / Add to list… pickers (active lists, in order). */
  project: { id: string; name: string; color: string; lists: { id: string; name: string }[] };
  /** The project's statuses in position order (the dialog's status menu). */
  statuses: StatusDTO[];
  homeList: { id: string; name: string };
  linkedLists: { id: string; name: string }[];
  /** Ancestors, root first. */
  breadcrumb: { id: string; title: string }[];
  /** Direct, non-deleted subtasks in position order. */
  subtasks: TaskRowDTO[];
  /** Every user's blocks for this task; only the owner (userId) can move or remove one. */
  timeBlocks: { id: string; start: string; end: string; syncState: string; userId: string }[];
  createdBy: UserLite;
  createdAt: string;
  updatedAt: string;
};

/** Section 8.4 getListView: Visible(L) (6.7), completed included; the client renders and sorts. */
export type ListViewDTO = {
  list: { id: string; name: string; icon: string | null; subtaskDisplay: "NESTED" | "SEPARATE"; projectId: string };
  /** lists: the project's active lists in order (the Move to… / Add to list… pickers). */
  project: { id: string; spaceId: string; name: string; color: string; lists: { id: string; name: string }[] };
  statuses: StatusDTO[];
  tasks: TaskRowDTO[];
};

/** Section 9.5 My Tasks rows show where each task lives. */
export type MyTaskDTO = TaskRowDTO & {
  projectId: string;
  projectName: string;
  projectColor: string;
  listName: string;
};

/** Section 9.5. The client groups by due date (groupMyTasks in src/lib/my-tasks.ts). */
export type MyTasksDTO = {
  tasks: MyTaskDTO[];
  /** projectId → that project's statuses in position order (each row's status menu). */
  statusesByProject: Record<string, StatusDTO[]>;
};

// ---------- Comments and activity (Section 8.5) ----------

/**
 * One entry of a task's feed, oldest first. Activity is sent structured (type + payload) with
 * the names its ids refer to in `labels` (status, list, user and task ids → names/titles); the
 * browser turns it into a sentence with formatActivity (src/lib/activity-format.ts) so dates and
 * times show in the viewer's time zone. COMMENT_ADDED rows are left out: the comment is the entry.
 */
export type FeedItemDTO =
  | {
      kind: "comment";
      id: string;
      author: UserLite;
      /** Tiptap JSON; null once deleted ("Comment deleted"). */
      body: unknown | null;
      createdAt: string;
      editedAt: string | null;
      deleted: boolean;
      /** Written through an API token (Section 15); null for a person. */
      via: string | null;
      /** The viewer wrote it (6.10). */
      canEdit: boolean;
      /** The viewer wrote it, or is Admin/Owner (6.10). */
      canDelete: boolean;
    }
  | {
      kind: "activity";
      id: string;
      actor: UserLite;
      type: ActivityType;
      payload: Record<string, unknown>;
      labels: Record<string, string>;
      createdAt: string;
    };

// ---------- Calendar (Section 8.6 / 10.1) ----------

/** One of my scheduled slots. `completed`: the task is done (the block renders struck through). */
export type TimeBlockDTO = {
  id: string;
  taskId: string;
  taskTitle: string;
  projectColor: string;
  completed: boolean;
  start: string;
  end: string;
  syncState: "PENDING" | "SYNCED" | "ERROR";
  lastSyncError: string | null;
};

/** A date-only due date of an open task assigned to me, shown as a chip in the all-day row (10.1). */
export type DueChipDTO = { taskId: string; title: string; dueDate: string; projectColor: string };

/**
 * A Google Calendar event that isn't one of ours (Section 10.4), shown read-only in gray. All-day
 * events carry date-only start/end ("2026-10-02"; end exclusive); timed ones ISO instants.
 */
export type GoogleEventDTO = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string | null;
};

/** What `listGoogleEvents` returns: the events to show, and whether reconciling changed any of my blocks. */
export type GoogleEventsResult = {
  events: GoogleEventDTO[];
  /** My time blocks were moved or removed to match Google: refetch them. */
  changed: boolean;
};

// ---------- Docs (Section 8.7 / 11) ----------

export type PageTreeNodeDTO = { id: string; title: string; parentId: string | null; position: string };

export type DocPageDTO = {
  id: string;
  docId: string;
  title: string;
  /** Tiptap JSON. */
  content: unknown;
  /** The version this page is at: send it back as baseUpdatedAt when saving (11.2). */
  updatedAt: string;
  updatedBy: UserLite;
};

/** Everything the doc view needs for its first paint. */
export type DocViewDTO = {
  doc: { id: string; title: string; projectId: string; spaceId: string; projectName: string; projectColor: string };
  tree: PageTreeNodeDTO[];
  page: DocPageDTO;
};

/** `savePage`'s outcome: saved (the new version), or someone else saved first (11.2). */
export type SavePageResult =
  | { conflict?: false; updatedAt: string }
  | { conflict: true; updatedBy: UserLite; /** The server's current version: Overwrite resends with it. */ updatedAt: string };

// ---------- API tokens (Section 15) ----------

export type ApiTokenDTO = {
  id: string;
  name: string;
  scope: "READ" | "WRITE";
  /** First characters of the token, enough to recognise it ("sava_pat_ab3k"). */
  prefix: string;
  expiresAt: string | null;
  expired: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  owner: UserLite;
  /** The viewer created it. Owner/Admin also see (and may revoke) other members' tokens. */
  mine: boolean;
};
