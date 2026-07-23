import { describe, expect, it } from 'vitest';
import { parseRepoList } from '../../scripts/banners/collect';

const sample = JSON.stringify([
  {
    name: 'FormCraft',
    description: 'x',
    primaryLanguage: { name: 'C#' },
    stargazerCount: 53,
    isFork: false,
    isArchived: false,
    owner: { login: 'phmatray' },
  },
  {
    name: 'aFork',
    description: null,
    primaryLanguage: null,
    stargazerCount: 0,
    isFork: true,
    isArchived: false,
    owner: { login: 'phmatray' },
  },
  {
    name: 'oldThing',
    description: 'y',
    primaryLanguage: { name: 'Java' },
    stargazerCount: 1,
    isFork: false,
    isArchived: true,
    owner: { login: 'phmatray' },
  },
]);

describe('parseRepoList', () => {
  it('normalizes fields and filters forks + archived', () => {
    const repos = parseRepoList(sample, { skipForks: true, skipArchived: true });
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({ name: 'FormCraft', owner: 'phmatray', language: 'C#', stars: 53 });
  });
  it('keeps everything when filters are off', () => {
    expect(parseRepoList(sample, { skipForks: false, skipArchived: false })).toHaveLength(3);
  });
});
