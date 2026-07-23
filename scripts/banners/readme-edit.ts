export function ensureBannerInReadme(
  readme: string,
  repoName: string,
  bannerPath = '.github/banner.png',
): { content: string; changed: boolean } {
  if (readme.includes(`(${bannerPath})`)) {
    return { content: readme, changed: false };
  }
  const line = `![${repoName} banner](${bannerPath})`;
  const content = `${line}\n\n${readme.replace(/^\n+/, '')}`;
  return { content, changed: true };
}
