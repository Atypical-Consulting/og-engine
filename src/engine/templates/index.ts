import { announcementTemplate } from './announcement';
import { blogHeroTemplate } from './blog-hero';
import { defaultTemplate } from './default';
import { emailBannerTemplate } from './email-banner';
import { eventTemplate } from './event';
import { githubRepoTemplate } from './github-repo';
import { newsArticleTemplate } from './news-article';
import { pricingTemplate } from './pricing';
import { productCardTemplate } from './product-card';
import { profileCardTemplate } from './profile-card';
import { readmeBannerTemplate } from './readme-banner';
import { socialCardTemplate } from './social-card';
import { testimonialTemplate } from './testimonial';
import type { TemplateFn } from './types';

export type { TemplateFn, TemplateInput, TemplateResult } from './types';

export const TEMPLATES: Record<string, TemplateFn> = {
  default: defaultTemplate,
  'social-card': socialCardTemplate,
  'blog-hero': blogHeroTemplate,
  'email-banner': emailBannerTemplate,
  event: eventTemplate,
  'github-repo': githubRepoTemplate,
  'product-card': productCardTemplate,
  'readme-banner': readmeBannerTemplate,
  testimonial: testimonialTemplate,
  'news-article': newsArticleTemplate,
  pricing: pricingTemplate,
  'profile-card': profileCardTemplate,
  announcement: announcementTemplate,
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

export function getTemplate(name: string): TemplateFn {
  return TEMPLATES[name] ?? TEMPLATES.default;
}
