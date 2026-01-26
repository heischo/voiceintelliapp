import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display the settings page header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should display hotkey settings section', async ({ page }) => {
    await expect(page.getByText('Global Hotkey')).toBeVisible();
    await expect(page.getByText('Activation Shortcut')).toBeVisible();
  });

  test('should have hotkey dropdown with 5 options', async ({ page }) => {
    const hotkeySelect = page.locator('select').first();
    await expect(hotkeySelect).toBeVisible();

    // Should have 5 hotkey options based on COMMON_HOTKEYS in config.ts
    const options = hotkeySelect.locator('option');
    await expect(options).toHaveCount(5);
  });

  test('should display LLM provider section heading', async ({ page }) => {
    await expect(page.getByText('LLM Provider')).toBeVisible();
  });

  test('should have OpenAI provider button', async ({ page }) => {
    const openaiButton = page.getByRole('button', { name: /OpenAI.*GPT-4o/i });
    await expect(openaiButton).toBeVisible();
  });

  test('should have OpenRouter provider button', async ({ page }) => {
    const openRouterButton = page.getByRole('button', { name: /OpenRouter.*multiple/i });
    await expect(openRouterButton).toBeVisible();
  });

  test('should allow selecting LLM provider', async ({ page }) => {
    // Click on OpenRouter provider button
    const openRouterButton = page.getByRole('button', { name: /OpenRouter.*multiple/i });
    await openRouterButton.click();

    // The button should now have the selected state (border-primary)
    await expect(openRouterButton).toHaveClass(/border-primary/);
  });

  test('should display API key input', async ({ page }) => {
    await expect(page.getByPlaceholder(/API key/)).toBeVisible();
  });

  test('should toggle API key visibility', async ({ page }) => {
    const apiKeyInput = page.getByPlaceholder(/API key/);
    const toggleButton = page.getByRole('button', { name: /Show|Hide/ });

    // Initially should be password type
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Click to show
    await toggleButton.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Click to hide again
    await toggleButton.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('should display enrichment settings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Enrichment' })).toBeVisible();
    await expect(page.getByText('Default Mode')).toBeVisible();
    await expect(page.getByText('Auto-enrich')).toBeVisible();
  });

  test('should have enrichment mode dropdown with 5 modes', async ({ page }) => {
    // Find the enrichment mode select (second select on page)
    const modeSelect = page.locator('select').nth(1);
    await expect(modeSelect).toBeVisible();

    // Should have 5 enrichment modes
    const options = modeSelect.locator('option');
    await expect(options).toHaveCount(5);
  });

  test('should toggle auto-enrich setting', async ({ page }) => {
    // Find the auto-enrich toggle
    const autoEnrichSection = page.locator('text=Auto-enrich').locator('..').locator('..');
    const toggle = autoEnrichSection.locator('button').last();

    // Verify the toggle is visible and clickable
    await expect(toggle).toBeVisible();
    await toggle.click();
  });

  test('should display output settings section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Output' })).toBeVisible();
  });

  test('should have clipboard output option', async ({ page }) => {
    const clipboardButton = page.getByRole('button', { name: /Clipboard.*clipboard/i });
    await expect(clipboardButton).toBeVisible();
  });

  test('should have file output option', async ({ page }) => {
    const fileButton = page.getByRole('button', { name: /Save to File|Local File/i });
    await expect(fileButton).toBeVisible();
  });

  test('should display language settings section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  });

  test('should have English language option', async ({ page }) => {
    const englishButton = page.getByText('English').locator('..');
    await expect(englishButton).toBeVisible();
  });

  test('should have German language option', async ({ page }) => {
    const deutschButton = page.getByText('Deutsch').locator('..');
    await expect(deutschButton).toBeVisible();
  });

  test('should have Norwegian language option', async ({ page }) => {
    const norskButton = page.getByText('Norsk').locator('..');
    await expect(norskButton).toBeVisible();
  });

  test('should allow selecting language', async ({ page }) => {
    // Click on Deutsch
    const deutschButton = page.getByText('Deutsch').locator('..');
    await deutschButton.click();

    // Should be selected (has border-primary class)
    await expect(deutschButton).toHaveClass(/border-primary/);
  });

  test('should display history settings section', async ({ page }) => {
    // Use first() to avoid matching multiple elements
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.getByText('Retention Period')).toBeVisible();
  });

  test('should display notifications toggle', async ({ page }) => {
    await expect(page.getByText('Show Notifications')).toBeVisible();
  });

  test('should have retention period dropdown', async ({ page }) => {
    // Find the retention select (third select on page)
    const retentionSelect = page.locator('select').nth(2);
    await expect(retentionSelect).toBeVisible();

    // Should have 5 retention options
    const options = retentionSelect.locator('option');
    await expect(options).toHaveCount(5);
  });

  test('should display save button', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: 'Save Settings' });
    await expect(saveButton).toBeVisible();
  });

  test('should have back navigation link', async ({ page }) => {
    const backLink = page.locator('a[href="/"]');
    await expect(backLink).toBeVisible();
  });
});
