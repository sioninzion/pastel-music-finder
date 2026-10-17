import { test, expect } from "@playwright/test";
test("provided MP3s preload, play and survive offline reload", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.REAL_AUDIO,
    "Run explicitly against the actual supplied tracks.",
  );
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator(".ready-status")).toContainText("준비 완료", {
    timeout: 120000,
  });
  await expect(page.locator(".storage-pill")).toContainText(
    "오프라인 준비 완료",
    { timeout: 15000 },
  );
  await expect(page.getByLabel("음원 파일 선택")).toHaveCount(0);
  const tracks = await page.evaluate(() =>
    fetch("tracks.json").then((r) => r.json()),
  );
  const sizes = await page.evaluate(async (d) => {
    const c = await caches.open("music-finder-audio-v1");
    return Promise.all(
      d.tracks.map(async (t: any) => {
        const r = await c.match(
          new URL(
            `audio/${t.audioFile.slice(6)}?v=${t.audioVersion}`,
            location.href,
          ),
        );
        return r ? (await r.blob()).size : 0;
      }),
    );
  }, tracks);
  expect(sizes).toHaveLength(15);
  expect(sizes.every((n: number) => n > 1000000)).toBe(true);
  await page.screenshot({ path: "test-results/real-audio-ready.png" });
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.getByRole("button", { name: "문제 선택", exact: true }).click();
  await page.getByRole("button", { name: "01번 문제", exact: true }).click();
  await page.getByRole("button", { name: "1초 재생", exact: true }).click();
  await expect(page.locator(".play-state")).toContainText("재생 중", {
    timeout: 10000,
  });
  await expect(page.locator(".play-state")).toContainText("재생 대기", {
    timeout: 5000,
  });
  await page.keyboard.press("Escape");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "07번 문제", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await page.getByRole("button", { name: "07번 문제", exact: true }).click();
  await page.keyboard.press("3");
  await expect(page.locator(".play-state")).toContainText("재생 중", {
    timeout: 10000,
  });
  await expect(page.locator(".play-state")).toContainText("재생 대기", {
    timeout: 6000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    `Real MP3 cache: ${sizes.length} files, ${sizes.reduce((a: number, b: number) => a + b, 0)} bytes; offline playback passed`,
  );
});
