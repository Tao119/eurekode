import { test, expect } from "@playwright/test";

// Test user credentials
const timestamp = Date.now();
const testUser = {
  email: `user-${timestamp}@test.com`,
  password: "TestPass123!",
  displayName: "テストユーザー",
};

const adminUser = {
  email: `admin-${timestamp}@test.com`,
  password: "AdminPass123!",
  displayName: "管理者テスト",
  organizationName: "テスト組織",
};

test.describe.serial("Full Application Flow Test", () => {
  test("1. Register new member user", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Fill form
    await page.fill('input[name="displayName"]', testUser.displayName);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.password);

    // User type is already "individual" by default

    // Check terms checkbox
    await page.click('[role="checkbox"]');

    await page.screenshot({ path: "screenshots/flow-01-register-filled.png" });

    // Submit
    await page.click('button[type="submit"]');

    // Wait for registration to complete (redirect to home or login)
    await page.waitForURL(/\/(login)?$/, { timeout: 15000 });
    await page.screenshot({ path: "screenshots/flow-02-after-register.png" });

    console.log("✅ Member registration completed");
  });

  test("2. Login with member user", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);

    await page.screenshot({ path: "screenshots/flow-03-login-filled.png" });

    await page.click('button[type="submit"]');

    // Wait for redirect to home
    await page.waitForURL("/", { timeout: 15000 });
    await page.screenshot({ path: "screenshots/flow-04-home-loggedin.png" });

    // Verify logged in
    await expect(page.locator("text=ログアウト")).toBeVisible({ timeout: 5000 });

    console.log("✅ Member login successful");
  });

  test("3. Access chat explanation mode", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });

    // Navigate to explanation chat
    await page.goto("/chat/explanation");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-05-chat-explanation.png" });

    // Verify chat UI is visible (not redirected to login)
    await expect(page.locator("textarea, input[type='text']")).toBeVisible({ timeout: 5000 });

    console.log("✅ Chat explanation mode accessible");
  });

  test("4. Access chat generation mode", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });

    await page.goto("/chat/generation");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-06-chat-generation.png" });

    await expect(page.locator("textarea, input[type='text']")).toBeVisible({ timeout: 5000 });

    console.log("✅ Chat generation mode accessible");
  });

  test("5. Access chat brainstorm mode", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });

    await page.goto("/chat/brainstorm");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-07-chat-brainstorm.png" });

    await expect(page.locator("textarea, input[type='text']")).toBeVisible({ timeout: 5000 });

    console.log("✅ Chat brainstorm mode accessible");
  });

  test("6. Access settings page", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-08-settings.png" });

    // Verify settings page content
    await expect(page.locator("text=設定")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=プロフィール")).toBeVisible({ timeout: 5000 });

    console.log("✅ Settings page accessible");
  });

  test("7. Logout", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });

    // Click logout
    await page.click("text=ログアウト");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-09-after-logout.png" });

    // Verify logged out (should see login button or be on home page)
    await expect(page.locator("text=ログイン").or(page.locator("text=無料で始める"))).toBeVisible({ timeout: 5000 });

    console.log("✅ Logout successful");
  });

  test("8. Register admin user", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Fill form
    await page.fill('input[name="displayName"]', adminUser.displayName);
    await page.fill('input[name="email"]', adminUser.email);
    await page.fill('input[name="password"]', adminUser.password);
    await page.fill('input[name="confirmPassword"]', adminUser.password);

    // Select admin type - click the admin card button
    await page.click('button:has-text("管理者")');

    // Fill organization name (should appear after selecting admin)
    await page.waitForSelector('input[name="organizationName"]', { timeout: 5000 });
    await page.fill('input[name="organizationName"]', adminUser.organizationName);

    // Check terms
    await page.click('[role="checkbox"]');

    await page.screenshot({ path: "screenshots/flow-10-admin-register.png" });

    // Submit
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(login|admin)?$/, { timeout: 15000 });
    await page.screenshot({ path: "screenshots/flow-11-after-admin-register.png" });

    console.log("✅ Admin registration completed");
  });

  test("9. Login as admin and access dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', adminUser.email);
    await page.fill('input[name="password"]', adminUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin)?$/, { timeout: 15000 });

    // Navigate to admin dashboard
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-12-admin-dashboard.png" });

    // Verify admin dashboard content
    await expect(page.locator("text=管理者ダッシュボード").or(page.locator("text=ダッシュボード"))).toBeVisible({ timeout: 5000 });

    console.log("✅ Admin dashboard accessible");
  });

  test("10. Access admin key management", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', adminUser.email);
    await page.fill('input[name="password"]', adminUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin)?$/, { timeout: 15000 });

    await page.goto("/admin/keys");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-13-admin-keys.png" });

    await expect(page.locator("text=アクセスキー")).toBeVisible({ timeout: 5000 });

    console.log("✅ Admin key management accessible");
  });

  test("11. Access admin member management", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', adminUser.email);
    await page.fill('input[name="password"]', adminUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin)?$/, { timeout: 15000 });

    await page.goto("/admin/members");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/flow-14-admin-members.png" });

    await expect(page.locator("text=メンバー")).toBeVisible({ timeout: 5000 });

    console.log("✅ Admin member management accessible");
  });
});
