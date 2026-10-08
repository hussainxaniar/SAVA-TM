import { expect, test, type Page } from "@playwright/test";
import { createSpace, gotoList, openRowMenu, openTask, PASSWORD, quickAdd, row, sidebar, signUp, uniqueEmail } from "./helpers";

// Section 13.2: the nine smoke flows. They build on each other (one user, one space), so they run in order.
test.describe.configure({ mode: "serial" });

let page: Page;
let spaceUrl: string;
const ownerEmail = uniqueEmail("owner");

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await page.context().close();
});

test("1. sign up, create a space and see Getting started", async () => {
  await signUp(page, "E2E Owner", ownerEmail);
  await createSpace(page, "E2E Space");
  await expect(sidebar(page).getByRole("link", { name: "Getting started" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "General" })).toBeVisible();
  spaceUrl = page.url();
});

test("2. quick add parses the title, tomorrow and p1", async () => {
  await quickAdd(page, "Write brief tomorrow p1");
  const brief = row(page, "Write brief");
  await expect(brief).toBeVisible();
  await expect(brief).toContainText("Tomorrow");
  await expect(brief.locator(".text-priority-1")).toBeVisible();
  // The tokens were stripped from the title.
  await expect(brief).not.toContainText("p1");
});

test("3. subtasks, then the Separate display shows the parent's title", async () => {
  const dialog = await openTask(page, "Write brief");
  for (const name of ["Draft outline", "Collect feedback"]) {
    // After Enter the add box may stay open for the next one; open it only when it is closed.
    const input = dialog.getByLabel("Subtask name");
    if (!(await input.isVisible())) await dialog.getByText("Add subtask", { exact: true }).click();
    await input.fill(name);
    await page.keyboard.press("Enter");
    await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  }
  // The first Escape closes the inline add box, the second the dialog.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "View options" }).click();
  await page.getByRole("menuitemradio", { name: "Separate" }).click();
  await page.keyboard.press("Escape");
  const sub = row(page, "Draft outline");
  await expect(sub).toBeVisible();
  await expect(sub).toContainText("Write brief");
});

test("4. a second list, and a subtask linked into it shows the parent title and link marker", async () => {
  await sidebar(page).getByRole("button", { name: "Getting started options", exact: true }).click({ force: true });
  await page.getByRole("menuitem", { name: "New list" }).click();
  await page.waitForURL(/\/l\//);
  await expect(page.getByRole("heading", { level: 1, name: "New list" })).toBeVisible();
  const secondListUrl = page.url();

  await gotoList(page, "General");
  await expect(row(page, "Draft outline")).toBeVisible();
  await openRowMenu(page, row(page, "Draft outline"));
  await page.getByRole("menuitem", { name: "Add to list" }).click();
  await page.getByRole("menuitem", { name: "New list" }).last().click();

  await page.goto(secondListUrl);
  const linked = row(page, "Draft outline");
  await expect(linked).toBeVisible();
  await expect(linked).toContainText("Write brief");
  await expect(linked.locator(".tabler-icon-link")).toBeVisible();
});

test("5. moving the parent to the second list takes its subtasks along and is logged", async () => {
  await gotoList(page, "General");
  await openRowMenu(page, row(page, "Write brief").first());
  await page.getByRole("menuitem", { name: "Move to" }).click();
  await page.getByRole("menuitem", { name: "New list" }).last().click();
  await expect(row(page, "Write brief")).toHaveCount(0);

  await gotoList(page, "New list");
  await expect(row(page, "Write brief").first()).toBeVisible();
  await expect(row(page, "Collect feedback")).toBeVisible();

  const dialog = await openTask(page, "Write brief");
  await expect(dialog).toContainText(/moved the task from General to New list/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("6. a comment appears in the activity feed", async () => {
  const dialog = await openTask(page, "Write brief");
  await dialog.locator("[contenteditable=true]").last().click();
  await page.keyboard.type("Looks good to me");
  await dialog.getByRole("button", { name: "Send comment" }).click();
  await expect(dialog.getByText("Looks good to me")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("7. an invite link lets a second user join and see the same project", async ({ browser }) => {
  await page.goto(spaceUrl.replace(/\/p\/.*$/, "/settings"));
  await page.getByRole("button", { name: "Create link" }).click();
  const inviteUrl = (await page.locator("span.font-mono").first().textContent())?.trim() ?? "";
  expect(inviteUrl).toMatch(/\/invite\//);

  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await signUp(guest, "E2E Guest", uniqueEmail("guest"));
  await guest.goto(inviteUrl);
  await guest.getByRole("button", { name: "Join E2E Space" }).click();
  await guest.waitForURL(/\/s\//);
  await expect(sidebar(guest).getByRole("link", { name: "Getting started" })).toBeVisible();
  await ctx.close();
});

test("8. calendar: dragging unscheduled tasks into the week creates blocks", async () => {
  // The rail lists my open tasks, so create two assigned to me (the guest from flow 7 also starts with "E2E", so the handle is the full name without spaces).
  await page.goto(spaceUrl);
  await quickAdd(page, "Plan sprint @e2eowner");
  await expect(row(page, "Plan sprint")).toBeVisible();
  await quickAdd(page, "Review budget @e2eowner");
  // Wait for the rows so the server has saved both before navigating away.
  await expect(row(page, "Review budget")).toBeVisible();

  await page.goto(spaceUrl.replace(/\/p\/.*$/, "/calendar"));
  const rail = page.getByRole("complementary").filter({ hasText: "Unscheduled" });
  await expect(rail.getByText("Plan sprint")).toBeVisible();

  // Tomorrow's column keeps every slot in the future whatever time the suite runs at.
  const tomorrow = await page.evaluate(() => {
    const d = new Date(Date.now() + 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const column = page.locator(`.fc-timegrid-col[data-date="${tomorrow}"]`);
  if (!(await column.count())) await page.getByRole("button", { name: "Next" }).click(); // today is the week's last day

  const drop = async (title: string, time: string) => {
    const src = await rail.getByText(title).boundingBox();
    const slot = page.locator(`.fc-timegrid-slot-lane[data-time="${time}"]`).first();
    const slotBox = await slot.boundingBox();
    const colBox = await column.boundingBox();
    if (!src || !slotBox || !colBox) throw new Error("drag targets not found");
    await page.mouse.move(src.x + 10, src.y + 8);
    await page.mouse.down();
    await page.mouse.move(colBox.x + colBox.width / 2, slotBox.y + 4, { steps: 12 });
    await page.mouse.up();
  };
  await drop("Plan sprint", "10:00:00");
  await expect(page.locator(".fc-event").filter({ hasText: "Plan sprint" })).toBeVisible();
  await expect(rail.getByText("Plan sprint")).toBeHidden(); // a future block takes it off the rail
  await drop("Review budget", "14:00:00");
  await expect(page.locator(".fc-event").filter({ hasText: "Review budget" })).toBeVisible();

  await page.reload();
  await expect(page.locator(".fc-event").filter({ hasText: /Plan sprint|Review budget/ })).toHaveCount(2);
});

test("9. a doc: add a child page, type, reload and the text persists", async () => {
  await page.goto(spaceUrl);
  await sidebar(page).getByRole("button", { name: "Getting started options", exact: true }).click({ force: true });
  await page.getByRole("menuitem", { name: "New doc" }).click();
  await page.waitForURL(/\/d\//);
  const tree = page.getByRole("complementary").filter({ hasText: "Add page" });
  await expect(tree).toBeVisible();

  // Add a child page under the first page, then write in it.
  // The URL already holds a page id (the first page), so wait for it to change to the new child's.
  const firstPageUrl = page.url();
  await tree.getByRole("button", { name: /^Add a page under / }).first().click({ force: true });
  await page.waitForURL((url) => url.href !== firstPageUrl);
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  // The footer already reads "Saved" before any edit, so wait for the autosave request that carries the text.
  const autosave = page.waitForResponse(
    (r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes("Persisted by the e2e suite") && r.ok(),
  );
  await page.keyboard.type("Persisted by the e2e suite");
  await autosave;
  await expect(page.getByText("Saved")).toBeVisible();

  await page.reload();
  await expect(page.locator(".ProseMirror").first()).toContainText("Persisted by the e2e suite");
});

test("10. an API token lets an MCP client create a task that shows up labelled via AI (Section 15)", async ({ request }) => {
  await page.goto(spaceUrl.replace(/\/p\/.*$/, "/integrations"));
  await expect(page.getByRole("heading", { name: "AI access" })).toBeVisible();
  await expect(page.getByText("No tokens yet")).toBeVisible();

  await expect(async () => {
    await page.getByRole("button", { name: "Create token" }).first().click({ timeout: 3000 });
    await expect(page.getByRole("dialog").getByLabel("Name")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("E2E assistant");
  await dialog.getByRole("button", { name: "Create token" }).click();
  const token = await dialog.getByLabel("API token").inputValue();
  expect(token).toMatch(/^sava_pat_/);
  await expect(dialog.getByText(/claude mcp add --transport http sava .*\/api\/mcp/)).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("E2E assistant")).toBeVisible();
  await expect(page.getByText("Never used")).toBeVisible();

  // Talk to the endpoint like an MCP client does.
  const call = async (method: string, params: unknown) => {
    const res = await request.post("/api/mcp", {
      headers: { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream" },
      data: { jsonrpc: "2.0", id: 1, method, params },
    });
    expect(res.ok()).toBe(true);
    return res.json();
  };
  const projects = JSON.parse((await call("tools/call", { name: "list_projects", arguments: {} })).result.content[0].text);
  const generalId = projects[0].lists.find((l: { name: string }) => l.name === "General").id;
  const created = JSON.parse(
    (await call("tools/call", { name: "create_task", arguments: { title: "Made by the assistant", listId: generalId, priority: 2 } })).result.content[0].text,
  );
  await call("tools/call", { name: "add_comment", arguments: { taskId: created.id, text: "Hello from the assistant" } });

  // The task is in the list, and its dialog shows the AI label on the activity and the comment.
  await page.goto(spaceUrl);
  const dialog2 = await openTask(page, "Made by the assistant");
  await expect(dialog2.getByText("Hello from the assistant")).toBeVisible();
  await expect(dialog2.getByText("via AI")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(dialog2).toBeHidden();

  // Revoking stops the token at once.
  await page.goto(spaceUrl.replace(/\/p\/.*$/, "/integrations"));
  await expect(async () => {
    await page.getByRole("button", { name: "Revoke" }).first().click({ timeout: 3000 });
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("No tokens yet")).toBeVisible();
  const after = await request.post("/api/mcp", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
  });
  expect(after.status()).toBe(401);
});

// Signing in again proves the account the suite created works outside the session that made it.
test("sign out and back in with the same account", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/sign-in");
  await p.getByLabel("Email").fill(ownerEmail);
  await p.getByLabel("Password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/\/s\//);
  await ctx.close();
});
