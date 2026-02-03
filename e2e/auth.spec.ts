import { test, expect } from "@playwright/test";

test.describe("Authentication Pages", () => {
  test.describe("Login Page", () => {
    test("should display login form", async ({ page }) => {
      await page.goto("/login");

      // Check page title and form elements (CardTitle renders as div, not heading)
      await expect(page.getByText("ログイン", { exact: false }).first()).toBeVisible();
      await expect(page.getByPlaceholder("email@example.com")).toBeVisible();
      await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
    });

    test("should show validation errors for empty form", async ({ page }) => {
      await page.goto("/login");

      // Click submit without filling form
      await page.getByRole("button", { name: "ログイン" }).click();

      // Should show validation messages (need to wait for form validation)
      await expect(page.getByText("有効なメールアドレスを入力してください")).toBeVisible({ timeout: 10000 });
    });

    test("should have link to registration page", async ({ page }) => {
      await page.goto("/login");

      const registerLink = page.getByRole("link", { name: "新規登録" });
      await expect(registerLink).toBeVisible();
      await registerLink.click();

      await expect(page).toHaveURL("/register");
    });

    test("should have link to join page", async ({ page }) => {
      await page.goto("/login");

      const joinLink = page.getByRole("link", { name: "キー入力" });
      await expect(joinLink).toBeVisible();
      await joinLink.click();

      await expect(page).toHaveURL("/join");
    });
  });

  test.describe("Register Page", () => {
    test("should display registration form", async ({ page }) => {
      await page.goto("/register");

      await expect(page.getByText("新規登録").first()).toBeVisible();
      await expect(page.getByText("自分用")).toBeVisible();
      await expect(page.getByText("管理者")).toBeVisible();
    });

    test("should toggle user type and show organization field for admin", async ({ page }) => {
      await page.goto("/register");

      // Click organization admin option (button containing "管理者" text)
      await page.getByRole("button", { name: /管理者.*組織/ }).click();

      // Organization name field should appear
      await expect(page.getByPlaceholder("株式会社○○")).toBeVisible();
    });

    test("should validate password requirements", async ({ page }) => {
      await page.goto("/register");

      // Fill in weak password using actual placeholders
      await page.getByPlaceholder("山田 太郎").fill("Test User");
      await page.getByPlaceholder("email@example.com").fill("test@example.com");
      await page.getByPlaceholder("8文字以上、英字と数字を含む").fill("short");
      await page.getByPlaceholder("パスワードを再入力").fill("short");
      // Check the terms checkbox
      await page.getByRole("checkbox").click();

      await page.getByRole("button", { name: "アカウントを作成" }).click();

      // Should show password validation error
      await expect(page.getByText("パスワードは8文字以上で入力してください")).toBeVisible({ timeout: 10000 });
    });

    test("should have link back to login page", async ({ page }) => {
      await page.goto("/register");

      const loginLink = page.getByRole("link", { name: "ログイン" });
      await expect(loginLink).toBeVisible();
      await loginLink.click();

      await expect(page).toHaveURL("/login");
    });
  });

  test.describe("Join Page (Access Key)", () => {
    test("should display access key form", async ({ page }) => {
      await page.goto("/join");

      await expect(page.getByText("キー入力").first()).toBeVisible();
      await expect(page.getByPlaceholder("山田 太郎")).toBeVisible();
      await expect(page.getByRole("button", { name: "参加する" })).toBeVisible();
    });

    test("should have 4 key input segments", async ({ page }) => {
      await page.goto("/join");

      // Should have 4 input fields for the key segments (with XXXXX placeholder)
      const keyInputs = page.getByPlaceholder("XXXXX");
      await expect(keyInputs).toHaveCount(4);
    });

    test("should have link back to login page", async ({ page }) => {
      await page.goto("/join");

      const loginLink = page.getByRole("link", { name: "ログイン" });
      await expect(loginLink).toBeVisible();
      await loginLink.click();

      await expect(page).toHaveURL("/login");
    });
  });

  test.describe("Home Page", () => {
    test("should display welcome message for unauthenticated users", async ({ page }) => {
      await page.goto("/");

      // Check for main content
      await expect(page.getByText("Eurekode").first()).toBeVisible();

      // Should see login/register buttons (use first() since there are multiple)
      await expect(page.getByRole("link", { name: "無料で始める" }).first()).toBeVisible();
    });

    test("should have navigation header with logo", async ({ page }) => {
      await page.goto("/");

      // Check for logo link
      const logoLink = page.getByRole("link", { name: /Eurekode/i }).first();
      await expect(logoLink).toBeVisible();
    });

    test("should display mode cards", async ({ page }) => {
      await page.goto("/");

      // Check for learning mode cards
      await expect(page.getByText("解説モード")).toBeVisible();
      await expect(page.getByText("生成モード")).toBeVisible();
      await expect(page.getByText("壁打ちモード")).toBeVisible();
    });
  });
});
