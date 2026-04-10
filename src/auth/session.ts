import {
  createSession,
  createUser,
  findMagicLinkByToken,
  findUserByEmail,
  linkApiKeysToUser,
  markMagicLinkUsed,
  type UserRecord,
} from '../db/index';

export function verifyMagicLink(token: string): { sessionToken: string; user: UserRecord } {
  const magicLink = findMagicLinkByToken(token);
  if (!magicLink) {
    throw new Error('Invalid or expired magic link.');
  }

  markMagicLinkUsed(token);

  // Find or create user
  let user = findUserByEmail(magicLink.email);
  if (!user) {
    user = createUser(magicLink.email);
  }

  // Link any existing API keys that were created before the user existed
  linkApiKeysToUser(magicLink.email, user.id);

  // Create session
  const sessionToken = crypto.randomUUID();
  createSession(user.id, sessionToken);

  return { sessionToken, user };
}
