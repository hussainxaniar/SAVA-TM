import { randomBytes, randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_EMAIL_DOMAIN, E2E_EMAIL_PREFIX } from "./teardown";

export const PASSWORD = "password123";

/** A fresh, unique e2e account email (cleaned up by the teardown). */
export function uniqueEmail(label: string) {
  return `${E2E_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${E2E_EMAIL_DOMAIN}`;
}

/**
 * Sign-up is invite-only (7.2.6), so the first e2e account needs an invite made straight in the
 * local database: an e2e user (removed by the teardown with its space) owns a throwaway space with
 * a one-use invite. Returns the invite's path. Local runs only, like the teardown.
 */
export async function makeBootstrapInvite(): Promise<string> {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const db = new PrismaClient();
  try {
    const user = await db.user.create({ data: { id: randomUUID(), name: "E2E Inviter", email: uniqueEmail("inviter") } });
    const token = randomBytes(32).toString("base64url");
    await db.space.create({
      data: {
        name: "E2E Bootstrap",
        createdById: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
        invites: { create: { token, createdById: user.id, expiresAt: new Date(Date.now() + 86_400_000), maxUses: 1 } },
      },
    });
    return `/invite/${token}`;
  } finally {
    await db.$disconnect();
  }
}

/** Creates an account through an invite link and the sign-up form; lands back on the invite page. */
export async function signUp(page: Page, name: string, email: string, invite: string) {
  const invitePath = new URL(invite, "http://x").pathname;
  await page.goto(invitePath); // proxy.ts remembers the invite for sign-up
  await page.goto(`/sign-up?next=${encodeURIComponent(invitePath)}`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/invite\//);
}

/** Creates the first space; lands on the "Getting started" project's General list. */
export async function createSpace(page: Page, name: string) {
  await page.getByLabel("Space name").fill(name);
  await page.getByRole("button", { name: "Create space" }).click();
  await page.waitForURL(/\/s\/[^/]+\/p\/[^/]+\/l\/[^/]+/);
  await expect(page.getByRole("heading", { level: 1, name: "General" })).toBeVisible();
}

/** The list-view row of a task, found by its visible title. */
export function row(page: Page, title: string | RegExp): Locator {
  return page.locator("[data-row-id]").filter({ hasText: title });
}

/** Opens quick add with `q` (focus must not be in a field) and submits the text. */
export async function quickAdd(page: Page, text: string) {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("q");
  const input = page.getByRole("dialog").getByLabel("Task name");
  await expect(input).toBeVisible();
  await input.fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Add task" }).click();
  await expect(input).toBeHidden();
}

/** The space sidebar (the first `aside` on a space page). */
export function sidebar(page: Page): Locator {
  return page.locator("aside").first();
}

/**
 * Opens a task's dialog from its list row. A click before the page has hydrated does nothing, so the click is
 * retried until the dialog shows (it never clicks again once the dialog is up).
 */
export async function openTask(page: Page, title: string): Promise<Locator> {
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) await row(page, title).first().getByText(title, { exact: true }).first().click({ timeout: 3000 });
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  return dialog;
}

/** Opens a row's context menu (right-click), retrying until it shows: a click before hydration does nothing. */
export async function openRowMenu(page: Page, taskRow: Locator) {
  const menu = page.getByRole("menu");
  await expect(async () => {
    if (!(await menu.isVisible())) await taskRow.click({ button: "right", timeout: 3000 });
    await expect(menu).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

/** Goes to a list through its sidebar link, retrying the click until the list's heading shows (pre-hydration clicks do nothing). */
export async function gotoList(page: Page, name: string) {
  const heading = page.getByRole("heading", { level: 1, name, exact: true });
  await expect(async () => {
    if (!(await heading.isVisible())) await sidebar(page).getByRole("link", { name: new RegExp(`^${name}( \\d+)?$`) }).click({ timeout: 3000 });
    await expect(heading).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}
