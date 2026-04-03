# OG Engine — Package Projet Complet

> **Moteur de génération d'images par API. Remplace Puppeteer. 500x plus rapide. Zéro navigateur.**
> Basé sur [Pretext](https://github.com/chenglou/pretext) par chenglou.

---

## Vue d'ensemble

OG Engine est une API qui génère des images (OG cards, bannières, visuels e-commerce) en utilisant la mesure de texte côté serveur au lieu d'un navigateur headless. Le moteur calcule les dimensions exactes de chaque ligne de texte — y compris CJK, arabe, emoji — en moins de 2ms, contre ~850ms pour Puppeteer.

**Marché :** Tout produit qui génère des images contenant du texte dynamique.
**Modèle :** API SaaS, freemium, usage-based. Free (500/mois) → 10€ → 39€ → 99€.
**Marge :** ~99% (pas de Chrome = coût marginal quasi nul).

---

## Documents inclus

### 1. Spécification technique
**Fichier :** `CLAUDE.md`
- Architecture : Bun + Hono + Pretext + @napi-rs/canvas
- Design de l'API : 3 endpoints (render, validate, batch)
- Structure du projet avec chaque fichier décrit
- Système de templates extensible
- Roadmap technique en 4 phases
- Commandes pour démarrer avec Claude Code

### 2. Monétisation
**Fichier :** `MONETIZATION.md`
- Intégration Stripe (Payment Links, webhooks)
- Génération et gestion des clés API
- Middleware d'authentification + compteur d'appels
- Reset mensuel automatique
- Free tier sans carte bancaire
- Envoi de clé par email (Resend)
- Schema SQLite (2 tables)

### 3. User Stories
**Fichier :** `USER-STORIES.md`
- 4 personas : Dev, Marketer, Visitor, Admin
- 10 epics couvrant tout le produit
- 29 user stories avec critères d'acceptation
- Priorisées : 12 P0 (MVP), 11 P1 (post-launch), 6 P2 (itération)

### 4. Plan d'acquisition & Go-to-Market
**Fichier :** `GO-TO-MARKET.md`
- 3 segments cibles (devs, SaaS, agences)
- Playbook de lancement jour par jour (HN, PH, Twitter, Reddit)
- Stratégie content marketing (6 articles SEO planifiés)
- Funnel de conversion détaillé avec taux estimés
- 8 emails automatisés (lifecycle)
- Partenariats stratégiques (CMS, frameworks, hébergeurs)
- KPIs et objectifs M1/M3/M6
- Budget prévisionnel (15€/mois au départ)
- Analyse des risques

### 5. Idées de fonctionnalités
**Fichier :** `FEATURES-IDEAS.md`
- 24 features en 7 catégories (IA, analytics, personnalisation, automatisation, rendu, DX, collaboration)
- Chaque feature évaluée : valeur, potentiel revenu, effort
- Matrice de priorisation : quick wins, high impact, game changers
- Top 5 : auto-fit, render depuis URL, A/B testing, variables dynamiques, env staging/prod

### 6. Landing page
**Fichier :** `landing-page.jsx`
- Page de vente complète en React
- Hero, stats animées, exemples de code (curl, SDK, Next.js)
- Tableau comparatif Puppeteer vs OG Engine
- 4 plans tarifaires avec boutons Stripe
- FAQ interactif, CTA de conversion
- Mobile-first, responsive

### 7. POC fonctionnel
**Fichier :** `og-engine.jsx`
- Générateur d'images OG interactif
- 4 tabs : contenu, style, background, export
- 8 Google Fonts, 8 couleurs d'accent, 6 gradients
- 5 formats (OG, Twitter, Square, LinkedIn, Story)
- Upload d'image de fond + overlay
- Download PNG + copy to clipboard
- Rendu Canvas en temps réel (~2ms)

---

## Pour démarrer

### Avec Claude Code :
```
claude
> Read CLAUDE.md and MONETIZATION.md, then build Phase 1 of the MVP.
> Start with the Hono server, Pretext integration, and /render endpoint.
```

### Manuellement :
```bash
mkdir og-engine && cd og-engine
bun init -y
bun add @chenglou/pretext @napi-rs/canvas hono zod
bun add -d typescript @types/node vitest
```

---

## Objectifs

| Horizon | Objectif |
|---------|----------|
| Semaine 1 | API fonctionnelle + landing page déployée |
| Semaine 2 | Lancement HN + PH + Twitter + Reddit |
| Mois 1 | 100 inscrits, 10 payants, 200€ MRR |
| Mois 3 | 1 000 inscrits, 80 payants, 1 500€ MRR |
| Mois 6 | 5 000 inscrits, 300 payants, 6 000€ MRR |
