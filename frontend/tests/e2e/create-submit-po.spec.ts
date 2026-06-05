import { test, expect } from '@playwright/test';

// These E2E tests require both backend (port 3001) and frontend (port 5173) running.
// Run: cd backend && npm run dev  (in one terminal)
//      cd frontend && npm run dev (in another terminal)
// Then: cd frontend && npm run test:e2e

test.describe('US1: Buyer creates and submits a low-value PO', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a test buyer JWT (userId=1, branchId=1, roles=['buyer'])
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'auth_token',
        'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOjEsInJvbGVzIjpbImJ1eWVyIl0sImJyYW5jaElkIjoxfQ.',
      );
    });
  });

  test('navigates to create page and sees form', async ({ page }) => {
    await page.goto('/purchase-orders');
    await page.click('text=+ New PO');
    await expect(page).toHaveURL('/purchase-orders/new');
    await expect(page.locator('h1')).toContainText('Create Purchase Order');
  });

  test('creates PO with line items and submits — auto-approved', async ({ page }) => {
    await page.goto('/purchase-orders/new');
    await page.fill('input[type="number"]:first-of-type', '10'); // supplierId

    // Fill first line item
    const rows = page.locator('div[style*="display: flex"]');
    await rows.nth(0).locator('input').nth(0).fill('1'); // productId
    await rows.nth(0).locator('input').nth(1).fill('5'); // quantity
    await rows.nth(0).locator('input').nth(2).fill('100'); // unitPrice ($500 total)

    await page.click('text=Create & Submit PO');
    await expect(page).toHaveURL(/\/purchase-orders\/\d+/);
    await expect(page.locator('text=APPROVED')).toBeVisible();
  });
});
