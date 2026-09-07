import 'server-only';

import { getSettings } from '../settings';
import { brightDataProvider } from './brightdata';
import { mockProvider } from './mock';
import type { PostProvider } from './types';

/**
 * `MOCK=1` forces fixtures regardless of stored settings, so local work and CI never touch
 * the network. Otherwise the runtime flag decides — an unrecognized value falls back to the
 * real provider rather than throwing, because a typo in a settings row edited from a phone
 * must not take the product down mid-event.
 */
export async function getProvider(): Promise<PostProvider> {
  if (process.env.MOCK === '1') return mockProvider;

  const { primaryProvider } = await getSettings();
  return primaryProvider === 'mock' ? mockProvider : brightDataProvider;
}
