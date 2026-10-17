import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/audio/**", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
});
function wav(seconds = 8) {
  const rate = 8000,
    n = rate * seconds,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 800),
      44 + i * 2,
    );
  return b;
}
async function prepare(page: Page) {
  await page.goto("./");
  await expect(page.getByLabel("음원 파일 선택")).toBeEnabled();
  await page.getByLabel("음원 파일 선택").setInputFiles(
    Array.from({ length: 15 }, (_, i) => ({
      name: `${String(i + 1).padStart(2, "0")} - test.wav`,
      mimeType: "audio/wav",
      buffer: wav(),
    })),
  );
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByRole("heading", { name: "게임 방법" })).toBeVisible();
  await page.screenshot({ path: "test-results/instructions-1366.png" });
  await page.getByRole("button", { name: "문제 선택", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "01번 문제", exact: true }),
  ).toBeVisible();
}
test("missing audio gates entry, no participant fields, invalid imports rejected", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByLabel("음원 파일 선택")).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "음악 맞추기 게임", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/welcome-1366.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "01번 문제", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("input:not([type=file])")).toHaveCount(0);
  await page.getByLabel("음원 파일 선택").setInputFiles({
    name: "01 - invalid.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toContainText("실패");
});
test("play timing, rapid replacement, pause, keyboard, completion and reset", async ({
  page,
}) => {
  await page.route("**/tracks.json", async (route) => {
    const r = await route.fetch();
    const d = await r.json();
    d.tracks[6].highlightStart = null;
    await route.fulfill({ json: d });
  });
  await page.addInitScript(() => {
    const win = window as any;
    win.audioEvents = [];
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: any[]) {
      win.audioEvents.push({ now: this.context.currentTime, args });
      return orig.apply(this, args as [number, number, number]);
    };
  });
  await prepare(page);
  await expect(page.locator(".statusbar")).toBeInViewport();
  await page.screenshot({ path: "test-results/finder-1366.png" });
  await page.getByRole("button", { name: "07번 문제", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "대표 구간 3초" }),
  ).toBeDisabled();
  await expect(page.locator(".content")).not.toContainText("Walking");
  await page.getByRole("button", { name: "1초 재생", exact: true }).click();
  await expect(page.locator(".play-state")).toContainText("준비 중");
  await expect(page.locator(".play-state")).toContainText("재생 중", {
    timeout: 3000,
  });
  await page.screenshot({ path: "test-results/question-1366.png" });
  await expect(page.locator(".play-state")).toContainText("재생 대기", {
    timeout: 3000,
  });
  const event = await page.evaluate(() => (window as any).audioEvents[0]);
  expect(event.args[0] - event.now).toBeGreaterThan(0.6);
  expect(event.args[2]).toBe(1);
  await page.keyboard.press("3");
  await page.keyboard.press("1");
  await page.keyboard.press("5");
  await expect(page.locator(".play-state")).toContainText("재생 중");
  await page.keyboard.press("Space");
  await expect(page.locator(".play-state")).toContainText("일시정지");
  await page.waitForTimeout(1200);
  await expect(page.locator(".play-state")).toContainText("일시정지");
  await page.keyboard.press("Space");
  await expect(page.locator(".play-state")).toContainText("재생 중");
  await expect(page.locator(".play-state")).toContainText("재생 대기", {
    timeout: 6500,
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "07번 문제 완료" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "07번 문제 완료" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "07번 문제 완료" }).click();
  await page.goBack();
  await expect(page.locator(".statusbar")).toContainText("1개 완료");
  await page
    .getByRole("button", { name: "진행도 초기화", exact: true })
    .click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "07번 문제 완료" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "진행도 초기화", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "진행도 초기화", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "07번 문제", exact: true }),
  ).toBeVisible();
});
test("offline reload, all fifteen finish, responsive layout and fixed mapping", async ({
  page,
  context,
}) => {
  await prepare(page);
  await expect(page.locator(".storage-pill")).toContainText(
    "오프라인 준비 완료",
  );
  const before = await page.evaluate(() =>
    fetch("tracks.json").then((r) => r.json()),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "01번 문제", exact: true }),
  ).toBeVisible();
  for (let i = 1; i <= 15; i++) {
    await page
      .getByRole("button", {
        name: `${String(i).padStart(2, "0")}번 문제`,
        exact: true,
      })
      .click();
    if (i === 1) {
      await page.keyboard.press("1");
      await expect(page.locator(".play-state")).toContainText("재생 중");
    }
    await page.keyboard.press("Escape");
  }
  await expect(page.getByText("GAME OVER", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "과연 승자는?" })).toBeVisible(
    { timeout: 6000 },
  );
  await page.screenshot({ path: "test-results/ending-1366.png" });
  await page.getByRole("button", { name: "음악 보관함으로" }).click();
  await page.reload();
  await expect(page.locator(".statusbar")).toContainText("15개 완료");
  await expect(page.getByRole("heading", { name: "과연 승자는?" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() => fetch("tracks.json").then((r) => r.json())),
  ).toEqual(before);
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.screenshot({ path: `test-results/finder-${size.width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  }
});
test("representative segment accepts mm:ss and full track uses complete duration", async ({
  page,
}) => {
  await page.route("**/tracks.json", async (route) => {
    const r = await route.fetch();
    const d = await r.json();
    d.tracks[0].highlightStart = "0:02";
    await route.fulfill({ json: d });
  });
  await page.addInitScript(() => {
    (window as any).audioEvents = [];
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: any[]) {
      (window as any).audioEvents.push(args);
      return orig.apply(this, args as [number, number, number]);
    };
  });
  await prepare(page);
  await page.getByRole("button", { name: "01번 문제", exact: true }).click();
  await page.keyboard.press("r");
  await expect(page.locator(".play-state")).toContainText("재생 중");
  let args = await page.evaluate(() => (window as any).audioEvents.at(-1));
  expect(args[1]).toBe(2);
  expect(args[2]).toBe(3);
  await page.keyboard.press("f");
  await expect(page.locator(".play-state")).toContainText("재생 중");
  args = await page.evaluate(() => (window as any).audioEvents.at(-1));
  expect(args[1]).toBe(0);
  expect(args[2]).toBeCloseTo(8, 2);
});
