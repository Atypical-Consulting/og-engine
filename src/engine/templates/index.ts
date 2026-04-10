import { blogHeroTemplate } from './blog-hero';
import { defaultTemplate } from './default';
import { emailBannerTemplate } from './email-banner';
import { eventTemplate } from './event';
import { githubRepoTemplate } from './github-repo';
import { productCardTemplate } from './product-card';
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
  testimonial: testimonialTemplate,
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

export function getTemplate(name: string): TemplateFn {
  return TEMPLATES[name] ?? TEMPLATES.default;
}
