import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_EMAIL_DOMAIN, E2E_EMAIL_PREFIX } from "./teardown";

export const PASSWORD = "password123";

/** A fresh, unique e2e account email (cleaned up by the teardown). */
export function uniqueEmail(label: string) {
  return `${E2E_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${E2E_EMAIL_DOMAIN}`;
}

/** Creates an account through the sign-up form; lands on "Create your space". */
export async function signUp(page: Page, name: string, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your space" })).toBeVisible();
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
