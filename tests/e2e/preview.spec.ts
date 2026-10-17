import { expect, test } from "@playwright/test";
import { richDocx } from "../fixtures/rich-docx";

// These checks cover the explicitly selected, browser-only quick reader.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("docslint-mode", "local"),
  );
});

const upload = {
  name: "rich.docx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: Buffer.from(richDocx()),
};

test("DOCX preserves text formatting, tables, images, numbering and header; duplicate text navigates to its own paragraph", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Chọn tài liệu DOCX").setInputFiles(upload);
  const formatted = page.getByTestId("paragraph-1");
  await expect(formatted).toHaveCSS("text-align", "center");
  const run = formatted.locator("span").last();
  await expect(run).toHaveCSS("font-family", "Arial");
  await expect(run).toHaveCSS("font-size", "21.3333px");
  await expect(run).toHaveCSS("font-weight", "700");
  await expect(run).toHaveCSS("font-style", "italic");
  await expect(run).toHaveCSS("text-decoration-line", "underline");
  await expect(run).toHaveCSS("color", "rgb(192, 48, 64)");
  const table = page.locator(".docx-render-host table");
  await expect(table.locator("td")).toHaveCount(2);
  await expect(table.locator("td").first()).toHaveCSS(
    "background-color",
    "rgb(230, 239, 218)",
  );
  await expect(table.locator("td").first()).toHaveCSS(
    "border-top-style",
    "solid",
  );
  const img = page.locator(".docx-render-host img");
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.locator(".docx-render-host header")).toContainText(
    "Đầu trang báo cáo",
  );
  await expect(page.getByTestId("paragraph-7")).toHaveCSS(
    "display",
    "list-item",
  );
  expect(
    await page
      .getByTestId("paragraph-7")
      .evaluate((el) => getComputedStyle(el, "::before").content),
  ).toContain("counter(");
  const duplicateIssue = page
    .locator(".issue-select")
    .filter({ hasText: "Đoạn 6" });
  await duplicateIssue.click();
  await expect(page.getByTestId("paragraph-5")).toHaveClass(/highlighted/);
  await expect(page.getByTestId("paragraph-2")).not.toHaveClass(/highlighted/);
  await expect(page.getByTestId("paragraph-4")).not.toHaveClass(/highlighted/);
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.screenshot({ path: "test-results/formatted-docx.png" });
  expect(errors).toEqual([]);
});

test("ignore persists for the same file, exports separately and can be restored", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles("public/sample-report.docx");
  await page.getByRole("button", { name: /^Bỏ qua: Giãn dòng/ }).click();
  await expect(page.locator(".issue-card")).toHaveCount(5);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất kết quả" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const result = JSON.parse(Buffer.concat(chunks).toString());
  expect(result.issues).toHaveLength(5);
  expect(result.ignoredIssues).toHaveLength(1);
  expect(result.ignoredIssues[0].ruleId).toBe(
    "standard/paragraph/line-spacing",
  );
  await page.reload();
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles("public/sample-report.docx");
  await expect(page.locator(".issue-card")).toHaveCount(5);
  // Same filename, different contents must not inherit decisions.
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles({ ...upload, name: "sample-report.docx" });
  await expect(page.getByRole("button", { name: /^Đã bỏ qua/ })).toContainText(
    "0",
  );
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles("public/sample-report.docx");
  await page.getByRole("button", { name: /^Đã bỏ qua/ }).click();
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await page.getByRole("button", { name: /^Khôi phục: Giãn dòng/ }).click();
  await expect(page.locator(".issue-card")).toHaveCount(0);
  await page.getByRole("button", { name: /^Tất cả/ }).click();
  await expect(page.locator(".issue-card")).toHaveCount(6);
  for (let i = 0; i < 6; i++)
    await page
      .getByRole("button", { name: /^Bỏ qua:/ })
      .first()
      .click();
  await expect(page.locator(".issue-list")).toContainText(
    "tài liệu chưa được sửa",
  );
});

test("expanded reader fills the desktop height and Escape restores workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await expect(page.getByTestId("paragraph-2")).toBeAttached();
  await expect(page.locator(".stats-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Mở rộng vùng đọc" }).click();
  await expect(page.locator("header.sidebar")).not.toBeVisible();
  const panel = await page.locator(".preview-panel").boundingBox();
  expect(panel!.y).toBe(0);
  expect(panel!.height).toBe(900);
  await expect(page.locator(".issues-panel")).toBeVisible();
  await expect(page.locator(".docx-render-host")).not.toHaveCSS("zoom", "1");
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.screenshot({ path: "test-results/expanded-reader.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("header.sidebar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mở rộng vùng đọc" }),
  ).toBeVisible();
});
