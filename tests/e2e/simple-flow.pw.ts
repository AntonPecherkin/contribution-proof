import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const scenario of [{ handle: 'devbuilder', title: 'Contribution Score' }, { handle: 'smallbuilder', title: 'Profile Score' }, { handle: 'thinbuilder', title: 'Contribution Score' }]) {
  test(`${scenario.title} (${scenario.handle}): real offline API, forms, reveal, details, share`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    if (scenario.handle === 'thinbuilder') await page.route('**/api/analyses/*', async route => {
      const response = await route.fetch();
      const body = await response.json();
      if (body.result?.kind === 'analysis') {
        delete body.result.peopleEngaged;
        delete body.result.daysBuilding;
      }
      await route.fulfill({ response, json: body });
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: () => { throw new Error('Download must not open native sharing'); } });
    });
    await page.goto('/');
    await expect(page.getByText('Ownership not verified')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter');
    await expect(page.locator('.entry-art')).toHaveCount(0);
    await expect(page.locator('.hero-logo')).toBeVisible();
    await page.getByLabel('Your X handle').fill(scenario.handle);
    await expect(page.locator('label[for="value"]')).toBeVisible();
    await expect(page.locator('label[for="value"]')).toHaveText('Your X handle');
    await expect(page.locator('#value')).toBeFocused();
    await expect(page.locator('#value')).not.toHaveAttribute('aria-label');
    await expect(page.locator('#consent')).toBeVisible();
    await expect(page.locator('#consent')).toHaveText('Your X handle · up to 20 recent public posts.');
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
    await expect(page.locator('.metric-grid')).not.toContainText('NaN');
    if (scenario.handle === 'devbuilder') {
      await expect(page.locator('.tile.green')).toContainText('People engaged in tech');
      await expect(page.locator('.tile.blue')).toContainText('Days building in public');
    }
    if (scenario.handle === 'thinbuilder') {
      await expect(page.locator('.tile.green')).toContainText('Technology posts');
      await expect(page.locator('.tile.blue')).toContainText('Times your posts were seen');
    }
    await expect(page.getByRole('button', { name: 'Download my card' })).toBeFocused();
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
    await page.getByRole('button', { name: 'Download my card' }).click();
    const card = await download;
    expect(card.suggestedFilename()).toBe('contribution-proof.png');
    await card.saveAs(`test-results/${scenario.handle}-share.png`);
    expect(await card.failure()).toBeNull();
    const png = await readFile(`test-results/${scenario.handle}-share.png`);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1080]);
    await page.getByRole('link', { name: 'Explore my opportunities' }).click();
    await expect(page).toHaveURL(/view=trends/);
    await expect(page.getByRole('heading', { name: 'Your next chapter' })).toBeVisible();
    await expect(page.locator('.company-card')).toHaveCount(3);
    for (const logo of await page.locator('.company-logo img').all()) {
      await expect(logo).toBeVisible();
      await expect.poll(() => logo.evaluate(el => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0)).toBe(true);
    }
    await expect(page.getByRole('link', { name: 'Get access to paid offers on ContentDC' })).toHaveAttribute('href', 'https://contentdc.com');
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/${scenario.handle}-trends.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('navigation', { name: 'Result pages' }).getByRole('link', { name: 'My card' }).click();
    await expect(page.locator('.tile')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Download my card' })).toBeEnabled();
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


test('Trends fills an unmatched profile with clearly general company suggestions', async ({ page, request }) => {
  const created = await request.post('/api/analyses', { data: { handle: 'smallbuilder', consentVersion: 'test' } });
  const { id } = await created.json();
  const completed = await (await request.get(`/api/analyses/${id}`)).json();
  completed.result.opportunities = [];
  await page.route(`**/api/analyses/${id}`, route => route.fulfill({ json: completed }));
  await page.goto(`/result/${id}?view=trends`);
  await expect(page.locator('.company-card')).toHaveCount(3);
  await expect(page.getByText('Also worth exploring', { exact: true })).toHaveCount(3);
  await page.getByRole('link', { name: 'My card', exact: true }).click();
  await expect(page.getByText('Profile Score', { exact: true })).toBeVisible();
});


test('image preparation can fail, retry, and download successfully', async ({ page, request }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let failed = false;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      if (!failed) { failed = true; throw new Error('Transient image failure'); }
      original.call(this, callback, type, quality);
    };
  });
  const created = await request.post('/api/analyses', { data: { handle: 'devbuilder', consentVersion: 'test' } });
  const { id } = await created.json();
  await page.goto(`/result/${id}`);
  await page.getByRole('button', { name: 'Explore my result' }).click();
  await expect(page.getByText('Couldn’t prepare your image. Try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry image' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my card' }).click();
  expect(await (await download).failure()).toBeNull();
});
