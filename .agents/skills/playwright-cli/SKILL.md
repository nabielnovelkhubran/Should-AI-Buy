---
name: playwright-cli
description: >-
  Browser-level testing, end-to-end automation, and UI interaction verification using Playwright CLI.
  Use for verifying keyboard navigation, command palette typing, autocomplete, tab completion,
  window dragging/resizing, multi-panel canvas states, and responsive layouts.
---

# Playwright CLI & Browser Testing Guide

This skill provides testing procedures and automation recipes for validating the **Should-AI Buy? Command Canvas** at the browser level using Playwright.

---

## 1. Playwright CLI Commands

```bash
# Run all end-to-end tests headless
npx playwright test

# Run a specific test file
npx playwright test tests/e2e/playwright-verification.spec.ts

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run tests with UI Mode
npx playwright test --ui

# Debug tests with Playwright Inspector
npx playwright test --debug

# View HTML test execution report
npx playwright show-report
```

---

## 2. Testing Recipes for Phase 9 Command Canvas

### A. Command Typing & Ghost Text Autocomplete
```typescript
test('typing into command palette displays ghost completion text', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Focus command input via shortcut
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox');
  await expect(input).toBeFocused();

  // Type partial prefix
  await input.pressSequentially('Should-AI buy $B', { delay: 50 });
  
  // Verify ghost autocomplete suggestion
  const ghostText = page.locator('[data-testid="ghost-autocomplete"]');
  await expect(ghostText).toContainText('TC');

  // Complete with Tab key
  await page.keyboard.press('Tab');
  await expect(input).toHaveValue('Should-AI buy $BTC?');
});
```

### B. Arrow-Key Navigation & Enter Execution
```typescript
test('arrow navigation selects suggestion and Enter executes', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const input = page.getByRole('combobox');
  await input.fill('Should');
  
  // Navigate suggestions
  await page.keyboard.press('ArrowDown');
  const firstOption = page.locator('[role="option"]').first();
  await expect(firstOption).toHaveAttribute('data-active', 'true');

  // Execute
  await page.keyboard.press('Enter');
});
```

### C. Canvas Window Dragging & Resizing
```typescript
test('floating panel can be dragged and repositioned on canvas', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  const windowHeader = page.locator('[data-testid="window-header-portfolio"]');
  const initialBox = await windowHeader.boundingBox();
  
  if (initialBox) {
    // Mouse drag
    await page.mouse.move(initialBox.x + 20, initialBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(initialBox.x + 120, initialBox.y + 80, { steps: 5 });
    await page.mouse.up();
    
    const newBox = await windowHeader.boundingBox();
    expect(newBox?.x).toBeGreaterThan(initialBox.x);
  }
});
```

### D. Multiple Simultaneous Panels & State Persistence
```typescript
test('multiple windows can be opened and persist layout after reload', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Open Deliberation and Portfolio windows
  await page.keyboard.press('Control+k');
  await page.keyboard.type('open portfolio');
  await page.keyboard.press('Enter');
  
  // Verify windows exist
  await expect(page.locator('[data-testid="window-portfolio"]')).toBeVisible();
  
  // Reload and check state restoration
  await page.reload();
  await expect(page.locator('[data-testid="window-portfolio"]')).toBeVisible();
});
```
