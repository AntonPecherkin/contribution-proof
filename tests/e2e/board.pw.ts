import { expect, test } from '@playwright/test';

test('projector board fits, protects opt-out identities and rotates spotlight', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/board/demo');
  await expect(page.getByText('Live room', { exact: true })).toBeVisible();
  await expect(page.locator('.board-featured h2')).toHaveText('@contentdc');
  await expect(page.locator('.board-featured-kind')).toHaveText('Profile Score');
  await expect(page.locator('.board-row')).toHaveCount(3);
  await expect(page.getByText('@did-not-opt-in')).toHaveCount(0);
  for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  }
  await page.clock.fastForward(12000);
  await expect(page.locator('.board-featured h2')).toHaveText('@jemmmyjemm');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: 'test-results/board-projector.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('new arrivals get spotlight and failed polls preserve the board', async ({ page, request }) => {
  const response = await request.get('/api/events/demo/board');
  const board = await response.json();
  let fail = false;
  await page.route('**/api/events/demo/board', route => fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: board }));
  await page.clock.install();
  await page.goto('/board/demo');
  await expect(page.getByText('Live room', { exact: true })).toBeVisible();
  board.justIn.unshift({ handle: 'new_builder', score: 700, kind: 'analysis', topTopic: 'Open source' });
  await page.clock.fastForward(5000);
  await expect(page.locator('.board-featured h2')).toHaveText('@new_builder');
  await expect(page.getByText('New on the board')).toBeVisible();
  fail = true;
  await page.clock.fastForward(5000);
  await expect(page.getByText('Reconnecting', { exact: true })).toBeVisible();
  await expect(page.locator('.board-featured h2')).toHaveText('@new_builder');
});

test('empty room invites participation without inventing activity', async ({ page }) => {
  await page.route('**/api/events/demo/board', route => route.fulfill({ json: {
    analysed: 0, technologyPosts: 0, totalViews: null, roomTopics: [], justIn: [], topToday: [],
  } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/board/demo');
  await expect(page.getByText('Your story belongs here.')).toBeVisible();
  await expect(page.getByText('Not available', { exact: true })).toBeVisible();
  await expect(page.locator('.board-row')).toHaveCount(0);
  expect(await page.locator('.board-connection > span').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
