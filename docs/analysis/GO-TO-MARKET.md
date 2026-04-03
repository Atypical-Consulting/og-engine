# OG Engine — Plan d'Acquisition & Go-to-Market

## Résumé exécutif

**Objectif mois 1 :** 100 inscrits free, 10 clients payants, €200 MRR
**Objectif mois 3 :** 1 000 inscrits free, 80 clients payants, €1 500 MRR
**Objectif mois 6 :** 5 000 inscrits free, 300 clients payants, €6 000 MRR

**Coût d'acquisition cible :** €0 (100% organique au départ)
**Canal principal :** Developer community + content
**Avantage compétitif narratif :** "Kill Puppeteer"

---

## 1. Segments cibles

### Segment A — Développeurs individuels (volume)
- **Qui :** Devs qui maintiennent un blog, un side-project, un SaaS
- **Problème :** Ils utilisent `@vercel/og` (limité) ou Puppeteer (lourd) pour leurs OG images
- **Où les trouver :** Twitter/X, Hacker News, Reddit r/webdev, Dev.to, GitHub
- **Plan typique :** Free → Starter (10€)
- **Volume estimé :** 80% des inscrits
- **Valeur :** Faible individuellement, mais crée la base community + bouche-à-oreille

### Segment B — SaaS & startups (valeur)
- **Qui :** Équipes produit de SaaS qui génèrent des OG images par page (docs, blog, marketplace)
- **Exemples concrets :** Notion-like, CMS headless, plateformes de contenu, marketplaces
- **Problème :** Infrastructure Puppeteer coûteuse, lente, difficile à maintenir
- **Où les trouver :** Twitter/X (CTO/devs), IndieHackers, LinkedIn
- **Plan typique :** Pro (39€) → Scale (99€)
- **Volume estimé :** 15% des inscrits
- **Valeur :** Gros usage, longue rétention, potentiel d'upsell

### Segment C — Agences & e-commerce (premium)
- **Qui :** Agences digitales, plateformes e-commerce, email marketing
- **Problème :** Génération de visuels dynamiques à grande échelle (bannières, fiches produit)
- **Où les trouver :** LinkedIn, Shopify ecosystem, salons e-commerce
- **Plan typique :** Scale (99€) → custom
- **Volume estimé :** 5% des inscrits
- **Valeur :** Très haute, mais cycle de vente plus long

---

## 2. Stratégie de lancement (Semaine 1-2)

### Jour J-7 : Préparer le terrain

- [ ] Créer le compte Twitter/X @ogengine
- [ ] Poster 3-4 tweets techniques montrant le POC (vidéos/GIFs du rendu instantané)
- [ ] Teaser : "On a mesuré 10 000 textes en 19ms sans ouvrir un navigateur. On en fait une API. Bientôt."
- [ ] Créer la page Product Hunt (mode "coming soon")
- [ ] Préparer le post Hacker News (Show HN)
- [ ] Rédiger le README GitHub avec badges, démo, et lien vers l'API

### Jour J : Lancement simultané sur 4 canaux

**Canal 1 — Hacker News (Show HN)**
```
Show HN: OG Engine – Generate OG images in ~22ms without a browser

We built an API that replaces Puppeteer/Playwright for generating social
images. It uses Pretext (text measurement without DOM) + server-side Canvas.

- Up to 30x faster than headless Chrome (6x warm, 30x cold start)
- 10MB vs 500MB memory per render
- Supports CJK, Arabic, emoji, mixed bidi
- Free tier: 500 images/month

Try it: https://og-engine.com
API docs: https://api.og-engine.com/docs
GitHub: https://github.com/xxx/og-engine
```
**Timing :** Mardi ou mercredi, 14h UTC (meilleur créneau HN)

**Canal 2 — Product Hunt**
- Tagline : "Generate OG images up to 30x faster. No browser needed."
- 4-5 screenshots : landing page, code example, speed comparison, template gallery
- Premier commentaire du maker expliquant la motivation
- Demander aux early testers de commenter

**Canal 3 — Twitter/X thread**
```
Thread structure (7-8 tweets) :
1. Hook : "We deleted Puppeteer from our stack. Here's what replaced it."
2. Le problème (Puppeteer = lent, lourd, cher)
3. La solution (Canvas + Pretext = ~22ms, up to 30x faster)
4. GIF de la démo (frappe clavier → rendu instantané)
5. Comparaison chiffrée (tableau Puppeteer vs OG Engine)
6. Code example (curl one-liner)
7. "Free tier, no credit card. Ship your OG images today."
8. Lien
```

**Canal 4 — Reddit**
- r/webdev : post technique avec benchmark
- r/nextjs : "How to generate OG images in Next.js without Puppeteer"
- r/SideProject : story du build

### Jour J+1 à J+7 : Amplification

- [ ] Répondre à CHAQUE commentaire sur HN, PH, Reddit, Twitter
- [ ] Publier les métriques du lancement en temps réel (transparence = crédibilité)
- [ ] Contacter 10 devs influents Twitter/X pour un RT (envoyer une clé API gratuite Pro)
- [ ] Poster le thread sur LinkedIn (version adaptée, plus business)
- [ ] Soumettre à les newsletters : TLDR, ByteByteGo, JavaScript Weekly, Node Weekly

---

## 3. Content marketing (Semaine 3-8)

### Blog technique (SEO long terme)

Publier 1 article/semaine sur le blog og-engine.com/blog. Chaque article cible un mot-clé spécifique.

| Semaine | Article | Mot-clé cible | Segment |
|---------|---------|---------------|---------|
| S3 | "How Pretext measures text without a browser" | pretext text measurement | A |
| S4 | "Replace Puppeteer OG images with a ~22ms API (30x faster)" | puppeteer og image alternative | A, B |
| S5 | "Generate dynamic email banners at scale" | dynamic email banner api | C |
| S6 | "Next.js OG images without @vercel/og limits" | next.js og image api | A |
| S7 | "Multilingual OG images: CJK, Arabic, emoji" | multilingual og image | B |
| S8 | "How we serve 1M images/month on a $20 server" | og image api cost | B, C |

### Format de chaque article
1. Problème concret (avec code "avant")
2. Solution avec OG Engine (avec code "après")
3. Benchmark / comparaison chiffrée
4. CTA : "Try it free — 500 images/month, no card"

### Contenu social recyclé
Chaque article = 1 thread Twitter + 1 post LinkedIn + 1 post Dev.to

---

## 4. Developer Relations

### Open source comme levier

- Le moteur de rendu (templates, layout) pourrait être open source
- L'API hébergée (auth, cache, CDN, scaling) est le produit payant
- Modèle : "open core" — comme Supabase, PostHog, Cal.com
- Le repo GitHub attire des stars, des contributors, et de la visibilité organique

### GitHub README comme funnel

```
README structure :
1. What it does (3 lignes)
2. Speed comparison (tableau)
3. Quick start (curl one-liner)
4. Self-host vs hosted API (tableau)
5. "Hosted API: free tier, no credit card → og-engine.com"
```

### Intégrations / templates

Créer des templates d'intégration prêts à copier-coller :
- [ ] Next.js app router (`/api/og/[slug]/route.ts`)
- [ ] Astro middleware
- [ ] Nuxt server route
- [ ] Express middleware
- [ ] Cloudflare Worker
- [ ] GitHub Action (générer les OG images au deploy)

Chaque template = un mini-article + un repo GitHub dédié

---

## 5. Canaux d'acquisition par ROI

| Canal | Coût | Effort | Délai | Impact | Priorité |
|-------|------|--------|-------|--------|----------|
| Hacker News (Show HN) | 0€ | 2h | J+0 | Spike massif (1k-10k visites) | ★★★ |
| Twitter/X thread | 0€ | 1h | J+0 | 500-5k impressions | ★★★ |
| Product Hunt | 0€ | 4h | J+0 | 500-2k visites | ★★★ |
| Reddit (r/webdev, r/nextjs) | 0€ | 1h | J+0 | 200-1k visites | ★★★ |
| Blog SEO | 0€ | 4h/article | 2-6 mois | Trafic récurrent | ★★★ |
| Dev newsletters | 0€ | 1h/soumission | 1-2 sem | 500-5k visites | ★★☆ |
| GitHub open source | 0€ | Continu | 1-3 mois | Stars + contributors | ★★☆ |
| LinkedIn posts | 0€ | 30min | J+0 | Segment C (agences) | ★★☆ |
| Dev.to / Hashnode | 0€ | 2h/article | 1-4 sem | SEO + communauté | ★★☆ |
| YouTube shorts / démos | 0€ | 2h | 1 sem | Visibilité long terme | ★☆☆ |
| Publicité payante | €€€ | Moyen | Immédiat | À tester après PMF | ☆☆☆ |

**Règle : pas de publicité payante avant 50 clients payants organiques.**
Si on ne peut pas convaincre 50 devs gratuitement, le produit a un problème.

---

## 6. Funnel de conversion

```
Visiteur landing page (100%)
    ↓ CTA "Commencer gratuitement"
Inscription email (30-40%)
    ↓ Reçoit clé API par email
Premier appel API (60-70% des inscrits)
    ↓ Intègre dans son projet
Usage régulier (40-50% des premiers appels)
    ↓ Atteint la limite de 500 appels
Upgrade Starter 10€ (8-12% des inscrits)
    ↓ Usage croissant
Upgrade Pro/Scale (20-30% des Starters)
```

### Leviers de conversion Free → Payant

1. **Limite basse mais pas frustrante** : 500 appels free = suffisant pour tester, pas pour un site en production
2. **Email de bienvenue** avec example code → réduit le time-to-first-call
3. **Email à 80% du quota** : "Vous avez utilisé 400/500 appels ce mois. Passez au Starter pour 10€ et débloquez 10 000 appels."
4. **Email à 100% du quota** : "Votre limite est atteinte. Vos images ne sont plus générées. Upgradez maintenant."
5. **Header HTTP sur chaque réponse** : `X-RateLimit-Remaining: 47` → le dev voit l'urgence dans son code

### Leviers de conversion Starter → Pro

1. **Batch endpoint** réservé au Pro → le dev qui veut générer en masse doit upgrader
2. **Cache CDN** réservé au Pro → performance perçue comme un premium
3. **Email quand l'usage dépasse 70% du Starter** : "Vous approchez des 10k. Le Pro à 39€ inclut 50k appels + batch + cache."

---

## 7. Emails automatisés (lifecycle)

| Trigger | Email | Objectif |
|---------|-------|----------|
| Inscription | Bienvenue + clé API + code example | Time-to-first-call < 5min |
| J+1 sans appel | "Besoin d'aide pour intégrer ?" + lien docs | Activation |
| J+3 avec appels | "Votre intégration fonctionne ! Voici des astuces avancées" | Engagement |
| 80% du quota | "400/500 appels utilisés. Pensez au Starter." | Conversion |
| 100% du quota | "Limite atteinte. Upgradez pour continuer." | Conversion urgente |
| J+7 post-upgrade | "Merci ! Voici les features Pro que vous pouvez maintenant utiliser" | Rétention |
| Chaque 1er du mois | "Votre rapport d'usage : X images générées, Yms moyen" | Rétention |
| 30 jours inactif | "On vous a manqué ? Votre clé API est toujours active." | Réactivation |

**Stack email :** Resend (transactionnel) + Loops.so ou Resend Broadcasts (lifecycle)

---

## 8. Partenariats stratégiques

### Court terme (mois 1-3)
- **Vercel** : Article "OG Engine vs @vercel/og" + integration template
- **Pretext** (chenglou) : Se faire connaître comme le premier produit commercial basé sur Pretext. PR au repo, mention dans le README
- **Blogs dev populaires** : Guest posts sur LogRocket, Smashing Magazine, CSS-Tricks

### Moyen terme (mois 3-6)
- **CMS headless** (Sanity, Contentful, Strapi) : Plugin officiel "auto-generate OG images"
- **Frameworks** : Template officiel pour Next.js, Astro, Nuxt
- **Hébergeurs** : Template de déploiement Vercel / Netlify / Railway

### Long terme (mois 6+)
- **Plateformes email** (Resend, Postmark, Sendgrid) : Partenariat pour bannières dynamiques
- **E-commerce** (Shopify, Medusa) : App/plugin pour visuels produit automatiques
- **Marketplaces API** (RapidAPI, APILayer) : Distribution additionnelle

---

## 9. Métriques clés (KPIs)

### Acquisition
| Métrique | Cible M1 | Cible M3 | Cible M6 |
|----------|----------|----------|----------|
| Visites landing page | 5 000 | 15 000 | 50 000 |
| Inscriptions (free) | 100 | 1 000 | 5 000 |
| Taux d'inscription | 2% | 6% | 10% |

### Activation
| Métrique | Cible |
|----------|-------|
| Time to first API call | < 5 min |
| % inscrits ayant fait 1 appel en 24h | > 60% |
| % inscrits ayant fait 10+ appels en 7 jours | > 30% |

### Revenu
| Métrique | Cible M1 | Cible M3 | Cible M6 |
|----------|----------|----------|----------|
| Clients payants | 10 | 80 | 300 |
| MRR | 200€ | 1 500€ | 6 000€ |
| ARPU | 20€ | 19€ | 20€ |
| Taux conversion free→payant | 10% | 8% | 6% |
| Churn mensuel | < 5% | < 5% | < 4% |

### Produit
| Métrique | Cible |
|----------|-------|
| Uptime API | > 99.9% |
| Temps de rendu P95 | < 25ms |
| Appels API total/mois | 50k → 500k → 5M |

---

## 10. Timeline semaine par semaine

### Semaine 1 : Build
- [ ] API fonctionnelle (Phase 1 du CLAUDE.md)
- [ ] Landing page déployée
- [ ] Stripe configuré (4 plans)
- [ ] Email de bienvenue automatisé

### Semaine 2 : Launch
- [ ] Show HN
- [ ] Product Hunt
- [ ] Twitter thread
- [ ] Reddit posts
- [ ] Soumettre aux newsletters

### Semaine 3 : Iterate
- [ ] Analyser les retours du lancement
- [ ] Fixer les bugs remontés
- [ ] Premier article de blog
- [ ] Contacter 10 early adopters pour feedback

### Semaine 4 : Optimize
- [ ] Email lifecycle (80%, 100% quota)
- [ ] Deuxième article de blog
- [ ] Templates d'intégration (Next.js, Astro)
- [ ] Améliorer la landing page selon les données

### Semaine 5-6 : Grow
- [ ] SDK TypeScript publié sur npm
- [ ] Documentation OpenAPI
- [ ] Troisième et quatrième articles de blog
- [ ] Guest post sur un blog dev populaire

### Semaine 7-8 : Scale
- [ ] Batch endpoint (Phase 2)
- [ ] Cache CDN
- [ ] Cinquième et sixième articles
- [ ] Premiers partenariats (CMS, frameworks)

---

## 11. Budget prévisionnel (6 premiers mois)

| Poste | Coût mensuel | Notes |
|-------|-------------|-------|
| Serveur API (Fly.io) | 10-30€ | Scale avec l'usage |
| Domaine og-engine.com | 1€ | Annuel ~12€ |
| Resend (emails) | 0€ | Free tier (3k emails/mois) |
| Stripe | 1.4% + 0.25€/tx | ~3€ à 200€ MRR |
| Cloudflare (CDN/DNS) | 0€ | Free tier |
| Monitoring (BetterStack) | 0€ | Free tier |
| **Total mois 1** | **~15€** | |
| **Total mois 6** | **~50€** | |

**Marge brute estimée à M6 :** 6 000€ MRR - 50€ infra = **99% de marge**

C'est l'avantage fondamental : pas de Chrome à faire tourner = coût marginal quasi nul par image.

---

## 12. Risques et mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Pretext ne fonctionne pas server-side | Bloquant | Faible | Tester dès la semaine 1. Fallback: Canvas measureText natif |
| @vercel/og s'améliore significativement | Moyen | Moyen | Différencier par les features (batch, templates, multi-format, fonts) |
| Faible traction au lancement | Moyen | Moyen | Itérer sur le messaging. Tester d'autres canaux (YouTube, Discord) |
| Problèmes de rendu cross-platform | Moyen | Faible | Tests visuels automatisés + polices embarquées (pas system fonts) |
| Abus du free tier | Faible | Moyen | Rate limiting par IP + email verification |
