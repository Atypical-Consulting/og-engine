# OG Engine — User Stories

## Personas

| Persona | Description |
|---------|-------------|
| **Dev** | Développeur intégrant l'API dans son produit (SaaS, blog, e-commerce) |
| **Marketer** | Marketeur utilisant l'API pour générer du contenu visuel à grande échelle |
| **Visitor** | Visiteur de la landing page, pas encore client |
| **Admin** | Administrateur de son compte OG Engine (facturation, clés) |

## Priorités

- **P0** — MVP, indispensable pour le lancement
- **P1** — Important, à livrer dans les 2 semaines post-lancement
- **P2** — Nice-to-have, itération post-lancement

---

## Epic 1 — Inscription & Authentification

### US-1.1 · Inscription gratuite sans carte bancaire
**Persona:** Visitor → Dev  
**Priorité:** P0

> En tant que visiteur, je veux créer un compte gratuit avec juste mon email, afin de tester l'API sans friction ni engagement financier.

**Critères d'acceptation:**
- Le visiteur envoie `POST /auth/register` avec `{ "email": "..." }`
- Le système génère une clé API au format `oge_sk_` + 32 caractères aléatoires
- La clé est envoyée par email en moins de 30 secondes
- L'email contient la clé, un exemple curl, et un lien vers la documentation
- Le plan est automatiquement "free" avec 500 appels/mois
- Si l'email existe déjà, renvoyer la clé existante (pas de doublon)

---

### US-1.2 · Souscription payante via Stripe
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux souscrire à un plan payant via un lien de paiement Stripe, afin d'obtenir plus d'appels API et de fonctionnalités avancées.

**Critères d'acceptation:**
- Chaque plan (Starter, Pro, Scale) a un Stripe Payment Link sur la landing page
- Après paiement, un webhook Stripe déclenche la création d'une clé API
- La clé est envoyée par email avec les détails du plan souscrit
- Si le dev a déjà un compte free, le plan est upgradé (pas de nouvelle clé)
- Le compteur d'appels est remis à zéro au moment de l'upgrade

---

### US-1.3 · Changement de plan
**Persona:** Admin  
**Priorité:** P1

> En tant qu'admin de mon compte, je veux changer de plan (upgrade ou downgrade), afin d'adapter mon abonnement à mon usage réel.

**Critères d'acceptation:**
- Le portail Stripe (lien dans l'email de bienvenue) permet de changer de plan
- Le webhook `customer.subscription.updated` met à jour la limite d'appels
- L'upgrade est effectif immédiatement
- Le downgrade prend effet au prochain cycle de facturation
- Le dev reçoit un email de confirmation du changement

---

### US-1.4 · Annulation d'abonnement
**Persona:** Admin  
**Priorité:** P1

> En tant qu'admin, je veux pouvoir annuler mon abonnement, afin de ne plus être facturé.

**Critères d'acceptation:**
- L'annulation se fait via le portail Stripe
- Le webhook `customer.subscription.deleted` rétrograde le plan à "free"
- La clé API reste active avec la limite free (500 appels/mois)
- Aucune donnée n'est supprimée

---

## Epic 2 — Génération d'images (/render)

### US-2.1 · Générer une image OG basique
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux envoyer un titre et une description à l'API et recevoir un PNG en retour, afin de générer automatiquement des images OG pour mon site.

**Critères d'acceptation:**
- `POST /render` avec `{ "format": "og", "title": "...", "description": "..." }` retourne un PNG
- Le Content-Type de la réponse est `image/png`
- Les headers incluent `X-Render-Time-Ms`, `X-Title-Lines`, `X-Desc-Lines`, `X-Layout-Overflow`
- Le temps de rendu est inférieur à 10ms (hors réseau)
- L'image fait exactement 1200×630 pixels
- Le titre est tronqué avec "…" s'il dépasse 3 lignes
- La description est tronquée avec "…" si elle dépasse 4 lignes

---

### US-2.2 · Choisir un format de sortie
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux choisir le format de l'image (OG, Twitter, Square, LinkedIn, Story), afin de générer des visuels adaptés à chaque plateforme.

**Critères d'acceptation:**
- Le champ `format` accepte: `og` (1200×630), `twitter` (1200×675), `square` (1080×1080), `linkedin` (1200×627), `story` (1080×1920)
- Chaque format ajuste le nombre max de lignes titre/description
- Le format Story autorise 5 lignes de titre et 6 de description
- Si le format est absent ou invalide, retourner une erreur 400

---

### US-2.3 · Personnaliser le style
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux personnaliser la couleur d'accent, la police, la taille du texte et le layout, afin que les images générées correspondent à ma marque.

**Critères d'acceptation:**
- `style.accent` accepte un code couleur hex (ex: "#38ef7d")
- `style.font` accepte le nom d'une police disponible (ex: "Outfit")
- `style.titleSize` accepte un nombre entre 28 et 72
- `style.descSize` accepte un nombre entre 14 et 32
- `style.layout` accepte: "left", "center", "bottom"
- Les valeurs par défaut sont appliquées si des champs sont omis
- `GET /health` retourne la liste des polices et layouts disponibles

---

### US-2.4 · Ajouter un tag/catégorie
**Persona:** Dev / Marketer  
**Priorité:** P1

> En tant qu'utilisateur, je veux ajouter un tag (ex: "Open Source", "Tutorial") qui apparaît comme un badge sur l'image, afin de catégoriser visuellement mon contenu.

**Critères d'acceptation:**
- Le champ `tag` est optionnel
- S'il est présent, il s'affiche comme une pilule arrondie au-dessus du titre
- Le texte du tag est affiché en majuscules
- La couleur de la pilule est dérivée de la couleur d'accent

---

### US-2.5 · Utiliser une image de fond
**Persona:** Dev / Marketer  
**Priorité:** P1

> En tant qu'utilisateur, je veux uploader une image de fond pour mon visuel, afin de créer des images plus riches et personnalisées.

**Critères d'acceptation:**
- L'endpoint accepte un upload multipart avec un champ `backgroundImage`
- Les formats acceptés sont: JPEG, PNG, WebP
- L'image est redimensionnée pour couvrir le canvas (object-fit: cover)
- Un overlay sombre est appliqué par défaut (opacité 0.65)
- Le champ `style.overlayOpacity` (0.2 à 0.9) permet de contrôler l'assombrissement
- La taille maximale du fichier est de 5MB
- Si l'image est invalide ou trop lourde, retourner une erreur 400

---

### US-2.6 · Choisir le format de sortie (PNG/WebP)
**Persona:** Dev  
**Priorité:** P1

> En tant que développeur, je veux choisir entre PNG et WebP comme format de sortie, afin d'optimiser la taille des fichiers selon mes besoins.

**Critères d'acceptation:**
- Le champ `output.format` accepte "png" (défaut) et "webp"
- Le champ `output.quality` (1-100) s'applique au WebP
- Le WebP est disponible à partir du plan Starter
- Si un utilisateur free demande du WebP, retourner une erreur 402 `plan_required` avec un message d'upgrade

---

### US-2.7 · Choisir un template
**Persona:** Dev  
**Priorité:** P1

> En tant que développeur, je veux choisir parmi plusieurs templates prédéfinis, afin de varier le style de mes visuels sans tout configurer manuellement.

**Critères d'acceptation:**
- Le champ `template` accepte: "default", "social-card", "blog-hero", "email-banner"
- Chaque template a son propre agencement (positions du texte, décorations, style)
- Le template "default" est utilisé si le champ est absent
- `GET /health` retourne la liste des templates disponibles

---

## Epic 3 — Validation de texte (/validate)

### US-3.1 · Vérifier si un texte tient dans un format
**Persona:** Dev / Marketer  
**Priorité:** P0

> En tant que développeur, je veux vérifier si mon titre et ma description tiennent dans un format donné sans générer d'image, afin de valider mes contenus rapidement et gratuitement.

**Critères d'acceptation:**
- `POST /validate` avec `{ "format": "og", "title": "...", "description": "..." }` retourne un JSON
- La réponse contient: `fits` (boolean), `title.lines`, `title.overflow`, `description.lines`, `description.overflow`
- Le temps de calcul est retourné dans `computeTimeMs`
- L'endpoint est gratuit et illimité sur tous les plans (y compris free)
- L'endpoint n'incrémente PAS le compteur d'appels
- Le temps de réponse est inférieur à 5ms

---

### US-3.2 · Valider avec des contraintes custom
**Persona:** Dev  
**Priorité:** P1

> En tant que développeur, je veux spécifier un nombre max de lignes custom pour le titre et la description, afin de tester des contraintes spécifiques à mon UI.

**Critères d'acceptation:**
- Les champs `maxTitleLines` et `maxDescLines` sont optionnels
- Par défaut: 3 lignes titre, 4 lignes description
- La réponse indique `overflow: true` si le texte dépasse la limite spécifiée
- On peut tester des polices et tailles différentes dans la même requête

---

## Epic 4 — Batch Processing

### US-4.1 · Générer plusieurs images en une requête
**Persona:** Dev / Marketer  
**Priorité:** P1

> En tant que développeur, je veux envoyer une liste de contenus et recevoir toutes les images en une seule requête, afin de générer des visuels en masse efficacement.

**Critères d'acceptation:**
- `POST /render/batch` accepte `{ "items": [...] }` avec jusqu'à 100 éléments
- Chaque élément a la même structure qu'une requête `/render` individuelle
- La réponse est un ZIP contenant les images nommées `0.png`, `1.png`, etc.
- Le temps total est retourné dans le header `X-Total-Render-Time-Ms`
- Chaque image du batch compte comme 1 appel API
- L'endpoint est réservé aux plans Pro et Scale
- Si un utilisateur Starter tente un batch, retourner 402 `plan_required` avec message d'upgrade

---

### US-4.2 · Erreurs partielles dans un batch
**Persona:** Dev  
**Priorité:** P2

> En tant que développeur, je veux que le batch continue même si un élément échoue, afin de ne pas perdre tout le traitement à cause d'une seule erreur.

**Critères d'acceptation:**
- Si un élément du batch échoue (champ manquant, police invalide), les autres sont quand même générés
- Le ZIP contient un fichier `errors.json` listant les indices et messages d'erreur
- Le header `X-Batch-Errors` indique le nombre d'erreurs

---

## Epic 5 — Usage & Limites

### US-5.1 · Contrôle des limites d'appels
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux que l'API refuse mes appels quand j'ai atteint ma limite mensuelle, avec un message clair, afin de comprendre pourquoi et comment upgrader.

**Critères d'acceptation:**
- Quand `calls_used >= calls_limit`, retourner HTTP 429
- Le body contient: `error`, `limit`, `used`, `plan`, `upgrade_url`
- Les headers contiennent: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Le compteur se remet à zéro au début de chaque cycle de facturation

---

### US-5.2 · Consulter mon usage
**Persona:** Dev / Admin  
**Priorité:** P1

> En tant qu'admin, je veux consulter mon usage actuel (appels consommés, limite, date de reset), afin de suivre ma consommation.

**Critères d'acceptation:**
- `GET /usage` retourne: `plan`, `calls_used`, `calls_limit`, `period_start`, `period_end`, `days_remaining`
- L'endpoint nécessite une clé API valide
- L'endpoint ne compte PAS comme un appel API

---

### US-5.3 · Reset mensuel automatique
**Persona:** Système  
**Priorité:** P0

> En tant que système, je dois remettre le compteur d'appels à zéro à chaque nouveau cycle de facturation, afin que les utilisateurs récupèrent leur quota.

**Critères d'acceptation:**
- Le webhook Stripe `invoice.paid` déclenche le reset
- `calls_used` est remis à 0
- `period_start` est mis à jour avec la date courante
- Pour les comptes free (pas de webhook Stripe), un cron mensuel reset le compteur

---

## Epic 6 — Gestion des erreurs

### US-6.1 · Erreurs structurées et actionnables
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux que les erreurs de l'API soient structurées et claires, afin de pouvoir les traiter programmatiquement.

**Critères d'acceptation:**
- Toutes les erreurs retournent du JSON: `{ "error": "code", "message": "description lisible", "details": {...} }`
- Codes d'erreur: `invalid_request`, `missing_field`, `invalid_font`, `invalid_format`, `unauthorized`, `rate_limited`, `plan_required`, `server_error`
- Les erreurs de validation listent tous les champs invalides (pas juste le premier)
- Les erreurs 4xx incluent un lien vers la documentation pertinente

---

### US-6.2 · Clé API invalide ou manquante
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux un message d'erreur clair si ma clé API est manquante ou invalide, afin de pouvoir corriger rapidement.

**Critères d'acceptation:**
- Pas de header Authorization → 401 `{ "error": "unauthorized", "message": "Missing API key. Include 'Authorization: Bearer oge_sk_...' header." }`
- Clé invalide → 401 `{ "error": "unauthorized", "message": "Invalid API key." }`
- Clé désactivée → 401 `{ "error": "unauthorized", "message": "API key has been deactivated." }`

---

## Epic 7 — Health & Discovery

### US-7.1 · Endpoint de santé
**Persona:** Dev  
**Priorité:** P0

> En tant que développeur, je veux un endpoint de santé qui me donne les capacités de l'API, afin de découvrir les polices, formats et templates disponibles.

**Critères d'acceptation:**
- `GET /health` retourne: `status`, `version`, `fonts[]`, `formats[]`, `templates[]`
- L'endpoint est public (pas de clé API requise)
- Le temps de réponse est inférieur à 50ms

---

## Epic 8 — Landing Page & Conversion

### US-8.1 · Page de vente avec pricing
**Persona:** Visitor  
**Priorité:** P0

> En tant que visiteur, je veux comprendre le produit, voir les prix et m'inscrire en moins de 2 minutes, afin de commencer à utiliser l'API rapidement.

**Critères d'acceptation:**
- La page contient: hero, stats, exemples de code, comparaison Puppeteer, pricing, FAQ, CTA
- Chaque bouton de pricing renvoie vers un Stripe Payment Link
- Le bouton "Free" renvoie vers un formulaire d'inscription par email
- La page est responsive (mobile-first)
- Le temps de chargement est inférieur à 2 secondes

---

### US-8.2 · Démo interactive sur la landing page
**Persona:** Visitor  
**Priorité:** P2

> En tant que visiteur, je veux tester le rendu en live sur la landing page, afin de voir la qualité avant de m'inscrire.

**Critères d'acceptation:**
- Une section "Try it" permet de saisir un titre et une description
- Le rendu est calculé côté client (Canvas) en temps réel
- Un bouton "Generate via API" montre la requête curl correspondante
- Le visuel se met à jour à chaque frappe

---

## Epic 9 — SDK & Documentation

### US-9.1 · SDK TypeScript
**Persona:** Dev  
**Priorité:** P1

> En tant que développeur, je veux un SDK TypeScript officiel, afin d'intégrer l'API sans écrire de fetch manuellement.

**Critères d'acceptation:**
- Package npm: `@atypical-consulting/og-engine-sdk`
- Méthodes: `render()`, `validate()`, `batch()`, `usage()`, `health()`
- Types TypeScript pour toutes les requêtes et réponses
- Gestion automatique de l'authentification (clé passée au constructeur)
- Retry automatique sur erreur 5xx (3 retries, exponential backoff 200ms/400ms/800ms)
- README avec exemples

---

### US-9.2 · Documentation OpenAPI
**Persona:** Dev  
**Priorité:** P1

> En tant que développeur, je veux une documentation OpenAPI/Swagger de l'API, afin de comprendre tous les endpoints et paramètres disponibles.

**Critères d'acceptation:**
- Spec OpenAPI 3.1 disponible à `/docs/openapi.json`
- Interface Swagger UI disponible à `/docs`
- Chaque endpoint documenté avec exemples de requête et réponse
- Les codes d'erreur sont documentés

---

## Epic 10 — Fonctionnalités avancées

### US-10.1 · Templates custom (JSON DSL)
**Persona:** Dev  
**Priorité:** P2 (Plan Scale uniquement)

> En tant que développeur Scale, je veux définir mes propres templates en JSON, afin de créer des visuels totalement sur mesure.

**Critères d'acceptation:**
- `POST /templates` crée un template custom avec un nom et une définition JSON
- La définition JSON spécifie les zones de texte (position, taille, police, couleur), les éléments décoratifs et les contraintes
- Le template est référençable dans `/render` via son nom
- Maximum 10 templates custom par compte
- Réservé au plan Scale

---

### US-10.2 · Webhook de régénération
**Persona:** Dev  
**Priorité:** P2 (Plan Pro+)

> En tant que développeur, je veux configurer un webhook qui régénère automatiquement mes images quand mon contenu change, afin de garder mes visuels à jour sans intervention manuelle.

**Critères d'acceptation:**
- `POST /webhooks` configure une URL de callback
- Quand le dev appelle `/render` avec un `content_id`, l'image est associée à cet ID
- Un appel à `POST /regenerate` avec le `content_id` et le nouveau contenu régénère l'image
- Le webhook notifie l'URL configurée avec l'URL de la nouvelle image
- Réservé aux plans Pro et Scale

---

### US-10.3 · Cache CDN
**Persona:** Dev  
**Priorité:** P2 (Plan Pro+)

> En tant que développeur, je veux que mes images générées soient servies depuis un CDN, afin d'avoir des temps de réponse ultra-rapides pour les utilisateurs finaux.

**Critères d'acceptation:**
- Chaque image générée est cachée avec un hash du contenu
- Si le même contenu est demandé à nouveau, l'image est servie depuis le cache
- Header `X-Cache: HIT` ou `X-Cache: MISS` dans la réponse
- Le cache expire après 7 jours ou sur régénération manuelle
- Le cache est inclus dans les plans Pro et Scale

---

### US-10.4 · AI text fitting
**Persona:** Dev / Marketer  
**Priorité:** P2

> En tant qu'utilisateur, je veux que l'API ajuste automatiquement la taille du texte pour que tout rentre dans le format choisi, afin de ne jamais avoir de texte tronqué.

**Critères d'acceptation:**
- Le champ `style.autoFit: true` active l'ajustement automatique
- L'algorithme réduit progressivement `titleSize` jusqu'à ce que le titre tienne en max N lignes
- La taille minimale est 24px pour le titre, 12px pour la description
- La réponse indique la taille finale utilisée dans les headers

---

## Résumé par priorité

| Priorité | Stories | Epic |
|----------|---------|------|
| **P0** | US-1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 5.1, 5.3, 6.1, 6.2, 7.1, 8.1 | MVP — 12 stories |
| **P1** | US-1.3, 1.4, 2.4, 2.5, 2.6, 2.7, 3.2, 4.1, 5.2, 9.1, 9.2 | Post-launch — 11 stories |
| **P2** | US-4.2, 8.2, 10.1, 10.2, 10.3, 10.4 | Itération — 6 stories |

**Total: 29 user stories across 10 epics.**
