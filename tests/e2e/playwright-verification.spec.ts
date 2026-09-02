import { test, expect } from '@playwright/test';

test.describe('Playwright Verification Suite — Should-AI Buy?', () => {
  test('1. Loads the application dashboard and displays core branding', async ({ page }) => {
    await page.goto('/');

    // Verify main header and brand title
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(page.locator('body')).toContainText('Should-AI Buy?');
  });

  test('2. Displays all workspace navigation tabs and switches views', async ({ page }) => {
    await page.goto('/');

    // Verify navigation tabs exist
    const commandTab = page.getByRole('button', { name: /Command Center/i });
    const discoveryTab = page.getByRole('button', { name: /Discovery Queue/i });
    const portfolioTab = page.getByRole('button', { name: /Portfolio & Risk/i });

    await expect(commandTab).toBeVisible();
    await expect(discoveryTab).toBeVisible();
    await expect(portfolioTab).toBeVisible();

    // Click Discovery tab and verify view renders
    await discoveryTab.click();
    await expect(page.locator('body')).toContainText('Autonomous Opportunity Discovery');

    // Click back to Command Center and verify view renders
    await commandTab.click();
    await expect(page.locator('body')).toContainText('Autonomous Decision & Execution Lifecycle');
  });

  test('3. Enforces Paper-Only environment visibility', async ({ page }) => {
    await page.goto('/');

    // Verify Paper-only badges exist
    await expect(page.locator('body')).toContainText('PAPER ONLY');
  });

  test('4. Renders Alpaca status badge and trading environment indicator', async ({ page }) => {
    await page.goto('/');

    // Verify Alpaca badge in header
    const header = page.locator('header');
    await expect(header).toContainText('Alpaca Paper');
    await expect(header).toContainText(/TEST PAPER|COMPETITION/i);
  });
});

