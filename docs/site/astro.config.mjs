import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://og-engine.com',
  integrations: [
    starlight({
      title: 'OG Engine',
      description: 'Generate images in 2ms. No browser required.',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/phmatray/og-engine' },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'Quick Start', link: '/quick-start/' },
        {
          label: 'Guides',
          items: [
            { label: 'Generating Images', link: '/guides/generating-images/' },
            { label: 'Formats & Templates', link: '/guides/formats-and-templates/' },
            { label: 'Customizing Styles', link: '/guides/customizing-styles/' },
            { label: 'Background Images', link: '/guides/background-images/' },
            { label: 'Text Validation', link: '/guides/text-validation/' },
            { label: 'Batch Rendering', link: '/guides/batch-rendering/' },
            { label: 'Error Handling', link: '/guides/error-handling/' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', link: '/api-reference/overview/' },
            { label: 'POST /render', link: '/api-reference/render/' },
            { label: 'POST /validate', link: '/api-reference/validate/' },
            { label: 'POST /render/batch', link: '/api-reference/batch/' },
            { label: 'GET /health', link: '/api-reference/health/' },
            { label: 'POST /auth/register', link: '/api-reference/register/' },
            { label: 'GET /usage', link: '/api-reference/usage/' },
            { label: 'Errors', link: '/api-reference/errors/' },
          ],
        },
        {
          label: 'SDK',
          items: [
            { label: 'Installation', link: '/sdk/installation/' },
            { label: 'Reference', link: '/sdk/reference/' },
          ],
        },
        { label: 'Templates Gallery', link: '/templates/gallery/' },
        { label: 'Available Fonts', link: '/fonts/available-fonts/' },
        { label: 'Self-Hosting (Docker)', link: '/self-hosting/docker/' },
        { label: 'Playground', link: '/playground/' },
        {
          label: 'Compare',
          items: [
            { label: 'OG Engine vs Puppeteer', link: '/compare/puppeteer/' },
          ],
        },
        { label: 'Pricing & Limits', link: '/pricing/' },
        { label: 'Changelog', link: '/changelog/' },
      ],
    }),
    react(),
  ],
});
