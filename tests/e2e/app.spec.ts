import { expect, test } from "@playwright/test";

test("sample document, diagnostic navigation, filters, search and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Báo cáo chỉn chu, từ từng chi tiết." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await expect(page.locator(".issue-card")).toHaveCount(6);
  await page.getByRole("button", { name: /Tiêu đề nhảy cấp/ }).click();
  await expect(page.getByTestId("paragraph-3")).toHaveClass(/highlighted/);
  await expect(page.locator(".suggestion")).toContainText("Heading 2");
  await page
    .getByRole("group", { name: "Lọc mức độ" })
    .getByRole("button", { name: /^Lỗi/ })
    .click();
  await expect(page.locator(".issue-card")).toHaveCount(3);
  await page
    .getByRole("group", { name: "Lọc mức độ" })
    .getByRole("button", { name: /Tất cả/ })
    .click();
  await page.getByRole("textbox", { name: "Tìm lỗi" }).fill("giãn dòng");
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Xóa tìm kiếm" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất kết quả" }).click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toMatch(/-lint.json$/);
  const stream = await downloaded.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const result = JSON.parse(Buffer.concat(chunks).toString());
  expect(result.issues).toHaveLength(6);
  expect(result.config.version).toBe(1);
  expect(errors).toEqual([]);
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/desktop-review.png",
    fullPage: true,
  });
});

test("real DOCX upload, configurable rules, plugin switches and preset import", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Chọn tài liệu DOCX")
    .setInputFiles("public/sample-report.docx");
  await expect(page.locator(".file-mini strong")).toHaveText(
    "sample-report.docx",
  );
  await expect(page.locator(".issue-card")).toHaveCount(6);
  const sampleResponse = await page.request.get("/sample-report.docx");
  const sampleBytes = Array.from(await sampleResponse.body());
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(bytes)], "dragged-report.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    return transfer;
  }, sampleBytes);
  await page.locator("main").dispatchEvent("dragover", { dataTransfer });
  await expect(
    page.getByText("Thả để kiểm tra tài liệu mới", { exact: true }),
  ).toBeVisible();
  await page.locator("main").dispatchEvent("drop", { dataTransfer });
  await expect(page.locator(".file-mini strong")).toHaveText(
    "dragged-report.docx",
  );
  await expect(page.locator(".drop-overlay")).toHaveCount(0);
  await expect(page.locator(".issue-card")).toHaveCount(6);
  await dataTransfer.dispose();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Bộ quy tắc/ })
    .click();
  await page.getByLabel("Cỡ chữ (pt)", { exact: true }).fill("12");
  await page.getByLabel("Cỡ chữ (pt)", { exact: true }).press("Enter");
  await expect(page.getByLabel("Cỡ chữ (pt)", { exact: true })).toHaveValue(
    "12",
  );
  await page.getByLabel("Cỡ chữ (pt)", { exact: true }).fill("13");
  await page.getByLabel("Cỡ chữ (pt)", { exact: true }).press("Enter");
  await page
    .getByLabel("Mức độ Font chữ nội dung", { exact: true })
    .selectOption("off");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Plugins/ })
    .click();
  await page.getByRole("switch", { name: "Bật plugin Academic" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kiểm tra tài liệu" })
    .click();
  await expect(page.locator(".issue-card")).toHaveCount(4);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Bộ quy tắc/ })
    .click();
  await page.getByLabel("Nhập preset JSON").setInputFiles({
    name: "preset.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        plugins: { standard: false, academic: false },
        rules: {},
      }),
    ),
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kiểm tra tài liệu" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chưa bật quy tắc nào" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Plugins/ })
    .click();
  await expect(
    page.getByRole("switch", { name: "Bật plugin Standard" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Bật plugin Academic" }),
  ).not.toBeChecked();
});

test("rejects invalid files and presets without losing the previous document", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await page.getByLabel("Chọn tài liệu DOCX").setInputFiles({
    name: "broken.docx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not a zip file"),
  });
  await expect(page.getByRole("alert")).toContainText("Không đọc được DOCX");
  await expect(page.locator(".issue-card")).toHaveCount(6);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Bộ quy tắc/ })
    .click();
  await page.getByLabel("Nhập preset JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(page.getByRole("alert")).toContainText("version: 1");
});

test("mobile layout and navigation remain usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await expect(page.locator(".issue-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Bộ quy tắc/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bộ quy tắc kiểm tra" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Plugins/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mở rộng bằng plugin." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("status").waitFor({ state: "hidden" });
  await page.screenshot({
    path: "test-results/mobile-plugins.png",
    fullPage: true,
  });
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`desktop workspace fits ${viewport.width}×${viewport.height} with independent scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
    await expect(page.locator(".issue-card")).toHaveCount(6);
    const metrics = await page.evaluate(() => {
      const paper = document
        .querySelector(".preview-panel")!
        .getBoundingClientRect();
      const issues = document
        .querySelector(".issues-panel")!
        .getBoundingClientRect();
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        paperRight: paper.right,
        issuesLeft: issues.left,
        panelHeight: paper.height,
      };
    });
    expect(metrics.width).toBeLessThanOrEqual(viewport.width);
    expect(metrics.height).toBeLessThanOrEqual(viewport.height);
    expect(metrics.paperRight).toBeLessThan(metrics.issuesLeft);
    expect(metrics.panelHeight).toBeGreaterThan(viewport.height * 0.6);
    await page
      .getByRole("button", { name: /Mục chưa có nội dung văn bản/ })
      .click();
    await expect(page.getByTestId("paragraph-11")).toHaveClass(/highlighted/);
    await expect
      .poll(() =>
        page.locator(".document-preview").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(
      page.getByRole("button", { name: "Xuất kết quả" }),
    ).toBeInViewport();
  });
}

test("desktop outline, zoom, keyboard navigation and help work together", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng tài liệu mẫu" }).click();
  await page.getByRole("button", { name: "Mục lục tài liệu" }).click();
  const outline = page.getByRole("complementary", {
    name: "Danh sách tiêu đề",
  });
  await expect(outline).toBeVisible();
  await expect(outline.getByRole("button")).toHaveCount(5);
  await outline
    .getByRole("button", { name: "4. Kết luận", exact: true })
    .click();
  await expect(page.getByTestId("paragraph-11")).toHaveClass(/highlighted/);
  await page
    .getByLabel("Thu phóng tài liệu", { exact: true })
    .selectOption("125");
  expect(
    await page
      .getByTestId("paragraph-2")
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe("20px");
  await expect(
    page.getByRole("button", { name: "Phóng to", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Thu nhỏ", exact: true }).click();
  await expect(
    page.getByLabel("Thu phóng tài liệu", { exact: true }),
  ).toHaveValue("110");
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.locator(".issue-card").nth(0)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.locator(".issue-card").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.locator(".issue-card").nth(0)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("/");
  await expect(page.getByRole("textbox", { name: "Tìm lỗi" })).toBeFocused();
  await page.getByRole("textbox", { name: "Tìm lỗi" }).fill("giãn dòng");
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Lỗi tiếp theo", exact: true })
    .click();
  await expect(page.getByTestId("paragraph-4")).toHaveClass(/highlighted/);
  await expect(
    page.getByRole("button", { name: "Lỗi tiếp theo", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Phím tắt", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Phím tắt", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Phím tắt", exact: true }),
  ).toBeFocused();
  const choosing = page.waitForEvent("filechooser");
  await page.keyboard.press("Control+o");
  await (await choosing).setFiles("public/sample-report.docx");
  await expect(page.locator(".file-mini strong")).toHaveText(
    "sample-report.docx",
  );
  await expect(page.locator(".issue-card")).toHaveCount(6);
});
