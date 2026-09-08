import { expect, test } from '@playwright/test';

for (const scenario of [{ handle: 'devbuilder', title: 'Contribution Score' }, { handle: 'smallbuilder', title: 'Profile Score' }]) {
  test(`${scenario.title}: real offline API, forms, reveal, details, share`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await expect(page.getByText('Ownership not verified')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter');
    await page.getByLabel('Your X handle').fill(scenario.handle);
    await page.screenshot({ path: `test-results/${scenario.handle}-handle.png`, fullPage: true });
    await page.getByRole('button', { name: 'Analyze my public posts' }).click();
    await expect(page).toHaveURL(/register\//);
    await page.getByLabel('Your email').fill('test@example.org');
    await page.screenshot({ path: `test-results/${scenario.handle}-email.png`, fullPage: true });
    const registration = page.waitForRequest(r => r.url().endsWith('/api/participants'));
    await page.getByRole('button', { name: 'Agree & join early access' }).click();
    expect((await registration).postDataJSON().boardOptIn).toBe(false);
    await expect(page).toHaveURL(/analyzing\//);
    await page.screenshot({ path: `test-results/${scenario.handle}-journey.png`, fullPage: true });
    await expect(page).toHaveURL(/result\//, { timeout: 20000 });
    await expect(page.getByText(scenario.title, { exact: true })).toBeVisible();
    await expect(page.locator('.score')).toHaveText(/^\d+$/);
    await expect(page.locator('.metric-grid')).toHaveCount(0);
    await page.screenshot({ path: `test-results/${scenario.handle}-reveal.png`, fullPage: true });
    await page.getByRole('button', { name: 'Explore my result' }).click();
    await expect(page.locator('.tile')).toHaveCount(4);
    await expect(page.getByText('Ownership not verified')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/${scenario.handle}-result.png`, fullPage: true });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share my card' }).click();
    expect((await download).suggestedFilename()).toBe('contribution-proof.png');
  });
}

test('private account gets retry, reduced motion disables logo animation', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await request.post('/api/analyses', { data: { handle: 'lockedaccount', consentVersion: 'test' } });
  const data = await response.json();
  await page.goto(`/analyzing/${data.id}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('private');
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
  const slow = await request.post('/api/analyses', { data: { handle: 'slowbuilder', consentVersion: 'test' } });
  const slowData = await slow.json();
  await page.goto(`/analyzing/${slowData.id}`);
  await expect(page.locator('.turning-logo')).toBeVisible();
  expect(await page.locator('.turning-logo').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.clock.install();
  await page.clock.fastForward(11000);
  await expect(page.getByText('This usually takes a minute or two.')).toBeVisible();
  await page.clock.fastForward(50000);
  await expect(page.getByText('Still collecting. Keep this page open.')).toBeVisible();
  await page.clock.fastForward(120000);
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
});
