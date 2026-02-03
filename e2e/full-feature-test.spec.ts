import { test, expect } from "@playwright/test";

// Test user credentials
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: "TestPassword123!",
  displayName: "テストユーザー",
};

const adminUser = {
  email: `admin-${Date.now()}@example.com`,
  password: "AdminPassword123!",
  displayName: "管理者テスト",
  organizationName: "テスト組織",
};

test.describe("Full Feature Test", () => {
  test.describe.serial("User Registration and Login Flow", () => {
    test("1. Register a new member user", async ({ page }) => {
      await page.goto("/register");
      await page.screenshot({ path: "screenshots/test-01-register-page.png" });

      // Fill registration form
      await page.fill('input[name="displayName"]', testUser.displayName);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirmPassword"]', testUser.password);

      // Select member user type
      await page.click('button[value="member"]');

      await page.screenshot({
        path: "screenshots/test-02-register-filled.png",
      });

      // Submit
      await page.click('button[type="submit"]');

      // Wait for redirect to login or home
      await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
      await page.screenshot({
        path: "screenshots/test-03-after-register.png",
      });

      console.log("✅ Member registration completed");
    });

    test("2. Login with registered user", async ({ page }) => {
      await page.goto("/login");
      await page.screenshot({ path: "screenshots/test-04-login-page.png" });

      // Fill login form
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);

      await page.screenshot({ path: "screenshots/test-05-login-filled.png" });

      // Submit
      await page.click('button[type="submit"]');

      // Wait for redirect to home
      await page.waitForURL("/", { timeout: 10000 });
      await page.screenshot({ path: "screenshots/test-06-after-login.png" });

      // Verify logged in state
      await expect(page.locator("text=ログアウト")).toBeVisible();

      console.log("✅ User login successful");
    });

    test("3. Access chat explanation mode", async ({ page }) => {
      // Login first
      await page.goto("/login");
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to explanation mode
      await page.goto("/chat/explanation");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: "screenshots/test-07-chat-explanation.png",
      });

      // Verify chat UI
      await expect(
        page.locator("text=解説").or(page.locator("text=説明"))
      ).toBeVisible();

      console.log("✅ Chat explanation mode accessible");
    });

    test("4. Access chat generation mode", async ({ page }) => {
      // Login first
      await page.goto("/login");
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to generation mode
      await page.goto("/chat/generation");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: "screenshots/test-08-chat-generation.png",
      });

      console.log("✅ Chat generation mode accessible");
    });

    test("5. Access chat brainstorm mode", async ({ page }) => {
      // Login first
      await page.goto("/login");
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to brainstorm mode
      await page.goto("/chat/brainstorm");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: "screenshots/test-09-chat-brainstorm.png",
      });

      console.log("✅ Chat brainstorm mode accessible");
    });

    test("6. Access user settings", async ({ page }) => {
      // Login first
      await page.goto("/login");
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to settings
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: "screenshots/test-10-settings.png" });

      // Verify settings page
      await expect(page.locator("text=設定")).toBeVisible();

      console.log("✅ User settings accessible");
    });

    test("7. Logout", async ({ page }) => {
      // Login first
      await page.goto("/login");
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Click logout
      await page.click("text=ログアウト");

      // Wait for redirect
      await page.waitForURL(/\/(login)?$/, { timeout: 10000 });
      await page.screenshot({ path: "screenshots/test-11-after-logout.png" });

      console.log("✅ Logout successful");
    });
  });

  test.describe.serial("Admin Registration and Dashboard", () => {
    test("8. Register admin user", async ({ page }) => {
      await page.goto("/register");

      // Fill registration form
      await page.fill('input[name="displayName"]', adminUser.displayName);
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      await page.fill('input[name="confirmPassword"]', adminUser.password);

      // Select admin user type
      await page.click('button[value="admin"]');

      // Fill organization name
      await page.fill(
        'input[name="organizationName"]',
        adminUser.organizationName
      );

      await page.screenshot({
        path: "screenshots/test-12-admin-register.png",
      });

      // Submit
      await page.click('button[type="submit"]');

      // Wait for redirect
      await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
      await page.screenshot({
        path: "screenshots/test-13-after-admin-register.png",
      });

      console.log("✅ Admin registration completed");
    });

    test("9. Admin login and dashboard access", async ({ page }) => {
      await page.goto("/login");

      // Login as admin
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to admin dashboard
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: "screenshots/test-14-admin-dashboard.png",
      });

      console.log("✅ Admin dashboard accessible");
    });

    test("10. Admin access key management", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to key management
      await page.goto("/admin/keys");
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: "screenshots/test-15-admin-keys.png" });

      // Verify key management page
      await expect(page.locator("text=アクセスキー")).toBeVisible();

      console.log("✅ Admin key management accessible");
    });

    test("11. Admin member management", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("/", { timeout: 10000 });

      // Navigate to member management
      await page.goto("/admin/members");
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: "screenshots/test-16-admin-members.png" });

      // Verify member management page
      await expect(page.locator("text=メンバー")).toBeVisible();

      console.log("✅ Admin member management accessible");
    });
  });
});
