import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');

    // Check that the page title/header is visible
    await expect(page.locator('h1')).toContainText('Voice Intelligence');
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');

    // Click the settings link
    await page.click('a[href="/settings"]');

    // Verify we're on the settings page
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should navigate to history page', async ({ page }) => {
    await page.goto('/');

    // Click the history link
    await page.click('a[href="/history"]');

    // Verify we're on the history page
    await expect(page).toHaveURL('/history');
    await expect(page.locator('h1')).toContainText('History');
  });

  test('should navigate back to main page from settings', async ({ page }) => {
    await page.goto('/settings');

    // Click the back link
    await page.click('a[href="/"]');

    // Verify we're on the main page
    await expect(page).toHaveURL('/');
  });

  test('should navigate back to main page from history', async ({ page }) => {
    await page.goto('/history');

    // Click the back link
    await page.click('a[href="/"]');

    // Verify we're on the main page
    await expect(page).toHaveURL('/');
  });
});
