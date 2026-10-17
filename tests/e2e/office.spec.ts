import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { richDocx } from "../fixtures/rich-docx";

async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "Lưu & kiểm tra lại" }),
  ).toBeEnabled({ timeout: 90000 });
  const frame = page
    .frames()
    .find((frame) => frame.url().includes("documenteditor/main"))!;
  const gotIt = frame.getByText("Got it", { exact: true });
  if (await gotIt.isVisible()) await gotIt.click();
  return frame;
}
async function append(page: Page, text: string) {
  const frame = await ready(page);
  await frame.locator("#id_main").click({ position: { x: 300, y: 120 } });
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText(text);
  await expect(page.locator(".office-panel .panel-footer")).toContainText(
    "Có thay đổi",
  );
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Lưu & kiểm tra lại" }).click();
  await expect(page.locator(".office-panel .panel-footer")).toContainText(
    "Đã lưu và kiểm tra",
    { timeout: 60000 },
  );
}
async function downloaded(page: Page) {
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải DOCX", exact: true }).click();
  const download = await wait;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return unzipSync(new Uint8Array(Buffer.concat(chunks)));
}

test("real Office editor edits, saves, re-lints, downloads and reopens the DOCX", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await ready(page);
  await expect(page.locator(".issue-card")).toHaveCount(6);
  await append(page, "Nội dung chỉnh sửa trực tiếp trên web.");
  await expect(page.locator(".live-indicator")).toContainText(
    "Cần kiểm tra lại",
  );
  await page.getByRole("button", { name: "Đổi tài liệu" }).click();
  // Opening the chooser alone doesn't close the current document.
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles("public/sample-report.docx");
  await expect(
    page.getByRole("dialog", { name: "Tài liệu có thay đổi chưa lưu" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quay lại lưu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Bộ quy tắc/ })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kiểm tra tài liệu" })
    .click();
  await save(page);
  await expect(page.locator(".issue-card")).toHaveCount(7);
  await expect(
    page
      .locator(".issue-select")
      .filter({ hasText: "Nội dung chỉnh sửa trực tiếp trên web." }),
  ).toHaveCount(1);
  const files = await downloaded(page);
  const xml = strFromU8(files["word/document.xml"]);
  expect(xml).toContain("Nội dung chỉnh sửa trực tiếp trên web.");
  expect(xml).toContain("Arial");
  await page.reload();
  await page
    .getByRole("button", { name: "Mở lại tài liệu đã lưu gần nhất" })
    .click();
  await ready(page);
  await expect(page.locator(".issue-card")).toHaveCount(7);
  await expect(
    page
      .locator(".issue-select")
      .filter({ hasText: "Nội dung chỉnh sửa trực tiếp trên web." }),
  ).toHaveCount(1);
  await append(page, "Bản lưu đã được mở lại thành công.");
  await save(page);
  const reopened = strFromU8((await downloaded(page))["word/document.xml"]);
  expect(reopened).toContain("Nội dung chỉnh sửa trực tiếp trên web.");
  expect(reopened).toContain("Bản lưu đã được mở lại thành công.");
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.screenshot({ path: "test-results/office-editor.png" });
});

test("Office round trip retains tables, image, numbering, header and character formatting", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles({
      name: "rich.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(richDocx()),
    });
  await ready(page);
  await append(page, "Đã chỉnh sửa bản có định dạng.");
  const files = await downloaded(page);
  const xml = strFromU8(files["word/document.xml"]);
  expect(xml).toContain("Đã chỉnh sửa bản có định dạng.");
  expect(xml).toContain("<w:tbl>");
  expect(xml).toMatch(/C03040/i);
  expect(xml).toContain("w:numPr");
  expect(xml).toContain("w:headerReference");
  expect(
    Object.keys(files).some((name) => name.startsWith("word/media/")),
  ).toBe(true);
  const headers = Object.entries(files).filter(([name]) =>
    /^word\/header.*\.xml$/.test(name),
  );
  expect(
    headers.some(([, bytes]) => strFromU8(bytes).includes("Đầu trang báo cáo")),
  ).toBe(true);
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.screenshot({ path: "test-results/office-rich-docx.png" });
});

test("Office outage is explicit and never silently renders the file as HTML", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { officeReady: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await expect(page.getByRole("alert")).toContainText("npm run office:up");
  await expect(page.locator(".docx-render-host")).toHaveCount(0);
});

test("failed save retains edits and can be retried", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await append(page, "Giữ nội dung khi lưu lỗi.");
  await page.route(
    "**/api/documents/*/snapshot",
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: "Lưu tạm thời bị gián đoạn." },
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Lưu & kiểm tra lại" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Lưu tạm thời bị gián đoạn.",
  );
  await expect(page.locator(".office-panel .panel-footer")).toContainText(
    "Có thay đổi",
  );
  await save(page);
  expect(strFromU8((await downloaded(page))["word/document.xml"])).toContain(
    "Giữ nội dung khi lưu lỗi.",
  );
});
