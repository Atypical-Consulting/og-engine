import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://og-engine.com',
  integrations: [
    starlight({
      title: 'OG Engine',
      description: 'Generate images in ~22ms — up to 30x faster than Puppeteer. No browser required.',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'OG Engine logo',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Atypical-Consulting/og-engine' },
      ],
      components: {
        Head: './src/components/Head.astro',
        SocialIcons: './src/components/SocialIcons.astro',
      },
      head: [
        // Default OG image for all pages
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://og-engine.com/og-image.svg' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:alt', content: 'OG Engine — Generate images in ~22ms, up to 30x faster than Puppeteer' },
        },
        // Twitter meta
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://og-engine.com/og-image.svg' },
        },
        // JSON-LD Organization + WebSite + SoftwareApplication
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'OG Engine',
              url: 'https://og-engine.com',
              logo: 'https://og-engine.com/og-image.svg',
              sameAs: ['https://github.com/Atypical-Consulting/og-engine'],
              founder: {
                '@type': 'Organization',
                name: 'Atypical Consulting',
                url: 'https://atypical.consulting',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'OG Engine',
              url: 'https://og-engine.com',
              description: 'Server-side image generation API. Generate OG images, social cards, and email banners in ~22ms — up to 30x faster than Puppeteer, no browser required.',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://og-engine.com/?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'OG Engine',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Any',
              url: 'https://og-engine.com',
              description: 'Server-side image generation API powered by Pretext text measurement. Generate OG images, social cards, and email banners in ~22ms — up to 30x faster than Puppeteer, zero browser dependencies.',
              offers: [
                {
                  '@type': 'Offer',
                  name: 'Free',
                  price: '0',
                  priceCurrency: 'EUR',
                  description: '500 renders/month, all fonts, all formats, all templates',
                },
                {
                  '@type': 'Offer',
                  name: 'Starter',
                  price: '10',
                  priceCurrency: 'EUR',
                  description: '10,000 renders/month with WebP output',
                },
                {
                  '@type': 'Offer',
                  name: 'Pro',
                  price: '39',
                  priceCurrency: 'EUR',
                  description: '50,000 renders/month with batch rendering and CDN caching',
                },
                {
                  '@type': 'Offer',
                  name: 'Scale',
                  price: '99',
                  priceCurrency: 'EUR',
                  description: '200,000 renders/month with custom templates and dedicated support',
                },
              ],
              featureList: [
                '~22ms render time (6-30x faster than Puppeteer)',
                'Zero browser dependencies',
                '500+ concurrent renders per instance',
                'CJK, Arabic, emoji, and bidirectional text support',
                'PNG and WebP output',
                '5 image formats (OG, Twitter, Square, LinkedIn, Story)',
                '4 built-in templates',
                '8 pre-loaded font families',
                'Text validation endpoint (free, unlimited)',
                'Open source and self-hostable',
              ],
            },
          ]),
        },
      ],
      customCss: ['./src/styles/fonts.css', './src/styles/custom.css', './src/components/playground.css'],
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'Playground', link: '/playground/', badge: { text: 'Try it', variant: 'success' } },
        { label: 'Templates Gallery', link: '/templates/gallery/' },
        { label: 'Benchmarks', link: '/benchmarks/' },
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
            { label: 'Next.js Integration', link: '/guides/nextjs/' },
            { label: 'Astro Integration', link: '/guides/astro/' },
            { label: 'Cloudflare Workers', link: '/guides/cloudflare-workers/' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', link: '/api-reference/overview/' },
            { label: 'POST /render', link: '/api-reference/render/' },
            { label: 'POST /render/from-url', link: '/api-reference/render-from-url/' },
            { label: 'POST /validate', link: '/api-reference/validate/' },
            { label: 'POST /render/batch', link: '/api-reference/batch/' },
            { label: 'GET /health', link: '/api-reference/health/' },
            { label: 'POST /auth/register', link: '/api-reference/register/' },
            { label: 'GET /usage', link: '/api-reference/usage/' },
            { label: 'Custom Templates', link: '/api-reference/templates/' },
            { label: 'Webhook Triggers', link: '/api-reference/triggers/' },
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
        {
          label: 'Resources',
          items: [
            { label: 'Available Fonts', link: '/fonts/available-fonts/' },
            { label: 'OG Engine vs Puppeteer', link: '/compare/puppeteer/' },
            { label: 'Self-Hosting (Docker)', link: '/self-hosting/docker/' },
          ],
        },
        { label: 'Pricing', link: '/pricing/' },
        { label: 'Changelog', link: '/changelog/' },
        {
          label: 'Blog',
          items: [
            { label: 'All Posts', link: '/blog/' },
            { label: 'Why We Built OG Engine', link: '/blog/why-we-built-og-engine/' },
            { label: 'How Pretext Measures Text', link: '/blog/how-pretext-measures-text/' },
            { label: 'Multilingual OG Images', link: '/blog/multilingual-og-images/' },
          ],
        },
      ],
    }),
    react(),
  ],
});
