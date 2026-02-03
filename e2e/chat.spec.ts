import { test, expect } from "@playwright/test";

test.describe("Chat Pages (Unauthenticated)", () => {
  test("explanation mode should redirect to login", async ({ page }) => {
    await page.goto("/chat/explanation");

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("generation mode should redirect to login", async ({ page }) => {
    await page.goto("/chat/generation");

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("brainstorm mode should redirect to login", async ({ page }) => {
    await page.goto("/chat/brainstorm");

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Mode Card Navigation", () => {
  test("clicking explanation mode card should navigate to explanation chat", async ({
    page,
  }) => {
    await page.goto("/");

    // Find and click explanation mode card
    const explanationCard = page.locator('a[href="/chat/explanation"]');
    await expect(explanationCard).toBeVisible();

    // Verify the card content
    await expect(page.getByText("解説モード")).toBeVisible();
    await expect(
      page.getByText("コードの構造や文法をAIが丁寧に解説します")
    ).toBeVisible();
  });

  test("clicking generation mode card should navigate to generation chat", async ({
    page,
  }) => {
    await page.goto("/");

    // Find generation mode card
    const generationCard = page.locator('a[href="/chat/generation"]');
    await expect(generationCard).toBeVisible();

    // Verify the card content
    await expect(page.getByText("生成モード")).toBeVisible();
    await expect(
      page.getByText("実装したい機能を言葉で伝えて、最適なコードスニペットを生成します")
    ).toBeVisible();
  });

  test("clicking brainstorm mode card should navigate to brainstorm chat", async ({
    page,
  }) => {
    await page.goto("/");

    // Find brainstorm mode card
    const brainstormCard = page.locator('a[href="/chat/brainstorm"]');
    await expect(brainstormCard).toBeVisible();

    // Verify the card content
    await expect(page.getByText("壁打ちモード")).toBeVisible();
    await expect(
      page.getByText("設計の悩みやアイデア出しをAIと対話しながら深めることができます")
    ).toBeVisible();
  });
});
