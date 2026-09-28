// TODO (T-03): Better Auth config + getSessionUser()

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};
