import { expect, test } from '@playwright/test';

for (const scenario of [{ handle: 'devbuilder', title: 'Contribution Score' }, { handle: 'smallbuilder', title: 'Profile Score' }]) {
  test(`${scenario.title}: real offline API, forms, reveal, details, share`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await expect(page.getByText('Ownership not verified')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter');
    await expect(page.locator('.entry-art')).toHaveCount(0);
    await expect(page.locator('.hero-logo')).toBeVisible();
    await page.getByLabel('Your X handle').fill(scenario.handle);
    await page.screenshot({ path: `test-results/${scenario.handle}-handle.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Analyze my public posts' }).click();
    await expect(page).toHaveURL(/register\//);
    await page.getByLabel('Your email').fill('test@example.org');
    await page.screenshot({ path: `test-results/${scenario.handle}-email.png`, fullPage: true, animations: 'disabled' });
    const registration = page.waitForRequest(r => r.url().endsWith('/api/participants'));
    await page.getByRole('button', { name: 'Agree & join early access' }).click();
    expect((await registration).postDataJSON().boardOptIn).toBe(false);
    await expect(page).toHaveURL(/analyzing\//);
    await page.screenshot({ path: `test-results/${scenario.handle}-journey.png`, fullPage: true, animations: 'disabled' });
    await expect(page).toHaveURL(/result\//, { timeout: 20000 });
    await expect(page.getByText(scenario.title, { exact: true })).toBeVisible();
    await expect(page.locator('.score')).toHaveText(/^\d+$/);
    await expect(page.locator('.metric-grid')).toHaveCount(0);
    const alignment = await page.locator('.score').evaluate(el => {
      const score = el.getBoundingClientRect();
      const card = el.closest('.result-card')!.getBoundingClientRect();
      return Math.abs((score.left + score.right) / 2 - (card.left + card.right) / 2);
    });
    expect(alignment).toBeLessThan(1);
    await page.screenshot({ path: `test-results/${scenario.handle}-reveal.png`, fullPage: true, animations: 'disabled' });
    if (scenario.handle === 'smallbuilder') await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Explore my result' }).click();
    await expect(page.locator('.tile')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Share my card' })).toBeFocused();
    if (scenario.handle === 'devbuilder') {
      await expect(page.locator('.result-card .card-topics')).toBeVisible();
      await page.locator('.card-topics summary').click();
      await expect(page.locator('.card-topics details')).toHaveAttribute('open', '');
    }
    if (scenario.handle === 'smallbuilder') expect(await page.locator('.tile').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await expect(page.getByText('Ownership not verified')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/${scenario.handle}-result.png`, fullPage: true, animations: 'disabled' });
    await page.getByText('Preview share image', { exact: true }).click();
    const preview = page.getByAltText('Your square share card');
    await expect(preview).toBeVisible();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const size = await preview.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
      expect(Math.abs(size.width - size.height)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await preview.screenshot({ path: `test-results/${scenario.handle}-share-preview.png` });
    await page.getByText('Preview share image', { exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share my card' }).click();
    const card = await download;
    expect(card.suggestedFilename()).toBe('contribution-proof.png');
    await card.saveAs(`test-results/${scenario.handle}-share.png`);
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
  await expect(page.getByText('Taking a little longer. Keep this page open.')).toBeVisible();
  await page.clock.fastForward(120000);
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
});

// Deliberately uses wall-clock time: exercise the cold-fetch wait, not a cached result.
test('140-second collection stays usable at 360px and completes', async ({ page, request }) => {
  test.setTimeout(165000);
  await page.setViewportSize({ width: 360, height: 800 });
  const created = await request.post('/api/analyses', { data: { handle: 'devbuilder', consentVersion: 'test' } });
  const { id } = await created.json();
  const completed = await (await request.get(`/api/analyses/${id}`)).json();
  expect(completed.status).toBe('complete');
  const started = Date.now();
  await page.route(`**/api/analyses/${id}`, route => route.fulfill({ json: Date.now() - started < 140000
    ? { id, status: 'fetching', stage: 'fetching' } : completed }));
  await page.goto(`/analyzing/${id}`);
  await expect(page.getByRole('heading')).toHaveText('Collecting your public posts');
  await expect(page.getByText('This usually takes a minute or two.')).toBeVisible({ timeout: 15000 });
  await page.getByText('What you’ll discover', { exact: true }).click();
  await expect(page.getByText(/If posts aren’t available/)).toBeVisible();
  await expect(page.getByText('Taking a little longer. Keep this page open.')).toBeVisible({ timeout: 55000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/slow-wait-60s.png', fullPage: true, animations: 'disabled' });
  await expect(page).toHaveURL(/result\//, { timeout: 90000 });
  await expect(page.locator('.score')).toHaveText(/^\d+$/);
  await expect(page.locator('.result-window')).toContainText('Posts from');
});

test('a stalled status request times out and polling recovers', async ({ page }) => {
  let requests = 0;
  await page.clock.install();
  await page.route('**/api/analyses/stalled', async route => {
    requests++;
    if (requests === 1) return; // A venue connection that never answers.
    await route.fulfill({ json: { id: 'stalled', status: 'fetching', stage: 'fetching' } });
  });
  await page.goto('/analyzing/stalled');
  await expect.poll(() => requests).toBe(1);
  // AbortSignal.timeout uses the browser's active-time clock, not mocked JS timers.
  await expect(page.getByText('Connection interrupted. Reconnecting…')).toBeVisible({ timeout: 15000 });
  await page.clock.runFor(1600);
  await expect.poll(() => requests).toBeGreaterThan(1);
  await expect(page.getByText('Connection interrupted. Reconnecting…')).toHaveCount(0);
  await expect(page.getByRole('heading')).toHaveText('Collecting your public posts');
});
