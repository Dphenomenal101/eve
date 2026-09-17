import { test, expect } from "@playwright/test";
test("hero scenario has no external network requests and restores its fixture", async ({
  page,
}) => {
  const outside: string[] = [];
  page.on("request", (req) => {
    if (!["127.0.0.1", "localhost"].includes(new URL(req.url()).hostname))
      outside.push(req.url());
  });
  await page.goto("/rehearsal?demo=1");
  await expect(page.getByText("2 of 6 steps complete")).toBeVisible();
  await page.getByRole("button", { name: "Review page", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve & publish", exact: true })
    .click();
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Review email", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve & send", exact: true })
    .click();
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate first request", exact: true })
    .click();
  await expect(page.getByText("5 of 6 steps complete")).toBeVisible();
  await page
    .getByRole("button", { name: "Review CRM update", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve action", exact: true })
    .click();
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("6 of 6 steps complete")).toBeVisible();
  await page.reload();
  await expect(page.getByText("6 of 6 steps complete")).toBeVisible();
  await page.getByRole("button", { name: "Start the rehearsal again" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  await expect(page.getByText("2 of 6 steps complete")).toBeVisible();
  expect(outside).toEqual([]);
});
test("global pause and navigation remain available on small screens", async ({
  page,
}) => {
  await page.goto("/overview?demo=1");
  await page.getByRole("button", { name: "Pause Eve", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume Eve", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume Eve", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause Eve", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
