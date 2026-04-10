import { countRecentMagicLinks, createMagicLink } from '../db/index';

const MAX_LINKS_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

export function createMagicLinkToken(email: string): { token: string } {
  const count = countRecentMagicLinks(email, WINDOW_MINUTES);
  if (count >= MAX_LINKS_PER_WINDOW) {
    throw new Error('Too many login requests. Please wait a few minutes.');
  }
  const token = crypto.randomUUID();
  createMagicLink(email, token);
  return { token };
}
