import { test, expect } from '@playwright/test';

test.describe('Main Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the application header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Voice Intelligence');
    await expect(page.getByText('Privacy-first voice assistant')).toBeVisible();
  });

  test('should display the recording button', async ({ page }) => {
    // The main recording button should be visible
    const recordButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(recordButton).toBeVisible();
  });

  test('should display hotkey instructions', async ({ page }) => {
    // Should show the hotkey hint
    await expect(page.getByText(/Click to start recording/)).toBeVisible();
    await expect(page.locator('kbd')).toBeVisible();
  });

  test('should display hotkey status indicator', async ({ page }) => {
    // Status indicator should be visible (red or green dot)
    const statusDot = page.locator('.rounded-full').first();
    await expect(statusDot).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await expect(page.locator('a[href="/history"]')).toBeVisible();
    await expect(page.locator('a[href="/settings"]')).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await expect(page.getByText('Privacy-first voice processing')).toBeVisible();
  });
});

test.describe('Main Page - Recording State (Mocked)', () => {
  test('should show recording instructions initially', async ({ page }) => {
    await page.goto('/');

    // Should show the "click to start" text
    await expect(page.getByText('Click to start recording')).toBeVisible();
  });
});
