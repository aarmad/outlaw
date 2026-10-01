# Outlaw : architecture

Ce document décrit les décisions d'architecture. Il doit rester à jour quand elles changent.

## 1. Décisions techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict | Cible Vercel ; Server Components et Server Actions évitent une API interne pour les formulaires. Dans Next 16, `middleware.ts` s'appelle **`proxy.ts`** et les APIs de requête (`cookies()`, `params`, `searchParams`) sont asynchrones. |
| ORM | **Drizzle** (plutôt que Prisma) | Pas de moteur binaire ni de cold start, donc adapté au serverless. Les agrégations financières s'écrivent en SQL lisible (`sql\`\``), les migrations sont des fichiers SQL versionnés, et le driver `postgres` est compatible avec le pooler transactionnel de Supabase (`prepare: false`). |
| Base | PostgreSQL (Supabase) | Managée, avec pooler et Auth intégrés. |
| Auth | Supabase Auth via `@supabase/ssr` | Inscription, confirmation e-mail, reset password et rate limiting fournis. La session est rafraîchie dans `proxy.ts` et l'identité est vérifiée par `getClaims()` (signature JWT). |
| Montants | **Entiers en centimes (BIGINT)** + colonne `currency` ; taux en **basis points** (2,9 % = 290) | Aucun flottant pour l'argent. Les arrondis passent par BigInt, à la demi-unité supérieure (`lib/finance/money.ts`). |
| Validation | Zod, côté serveur, sur chaque Server Action et chaque paramètre d'URL | |
| UI | Tailwind 4, shadcn/ui (Radix), Lucide, Recharts, next-themes | Palette des graphiques validée (daltonisme et contraste) en light et en dark. |
| Tests | Vitest, avec PGlite (Postgres WASM) pour les tests d'intégration SQL | Le vrai SQL tourne via le vrai driver, sans Docker. |

## 2. Organisation du code

```
app/
  (auth)/            login, signup, forgot-password, reset-password, actions.ts
  auth/callback/     échange code/token_hash des e-mails Supabase
  onboarding/        assistant de création du workspace (+ données démo)
  (dashboard)/       layout (sidebar + header), puis une route par section
proxy.ts             rafraîchissement de session + redirection optimiste
components/
  ui/                shadcn
  dashboard/         shell, KPI, tableaux, états vides
  charts/            Recharts
  forms/             form-kit (champs, messages, submit)
lib/
  finance/           ⚠️ toutes les formules (pures, testées)
  analytics/         agrégations SQL → profit engine
  auth/              session, contexte workspace, rôles, redirect sûr
  db/                schema.ts, client.ts, queries/* (accès scopé par workspace)
  demo/              générateur déterministe (pur) + seed transactionnel
  security/          chiffrement AES-256-GCM des tokens, comparaison à temps constant
  validation/        schémas Zod
  dates.ts           dates calendaires dans le fuseau du workspace
  format.ts          affichage uniquement, aucun calcul métier
drizzle/             migrations SQL générées
tests/               unitaires + intégration
```

Les dossiers `lib/integrations/{shopify,meta,aliexpress}`, `lib/attribution` et `lib/sync` arrivent avec leurs phases respectives.

### Règles

1. **Aucune formule financière dans un composant ni dans une requête SQL.** Le SQL ne fait que des sommes ; `lib/finance` calcule.
2. **Isolation par workspace.** L'id du workspace vient toujours de `requireWorkspace()` / `getWorkspaceContext()` côté serveur, jamais du client. Le cookie `outlaw_ws` n'est qu'une préférence, honorée seulement si l'utilisateur est membre.
3. **Aucune donnée inventée.** Une valeur inconnue s'affiche « — » avec la raison (« No ad spend »). Toute estimation est marquée `ESTIMATED`.
4. **Les secrets restent côté serveur.** `lib/env.ts`, `lib/db`, `lib/security` et `lib/auth/*` importent `server-only`.

## 3. Modèle de données

Fichier `lib/db/schema.ts`, 23 tables, toutes avec `workspace_id` et RLS activé sans policy (défense en profondeur : la Data API publique de Supabase ne voit rien).

```
users ─┬─ workspace_members ─ workspaces ─┬─ workspace_settings  (hypothèses financières)
       │                                  ├─ stores ─ orders ─┬─ order_line_items (COGS figé à la commande)
       │                                  │                   ├─ refunds
       │                                  │                   └─ attributions (DIRECT_MATCH | UTM_MATCH | INFERRED | UNATTRIBUTED)
       │                                  ├─ products ─┬─ product_variants
       │                                  │            ├─ product_cost_history (append-only, effective_from, variante/pays optionnels)
       │                                  │            └─ offers ─ offer_tiers
       │                                  ├─ integrations (token chiffré) ─ sync_jobs ─ sync_logs
       │                                  ├─ ad_accounts ─ campaigns ─ ad_sets ─ ads ─ ad_insights_daily (1 ligne/ad/jour)
       │                                  └─ insights
```

Points clés :
- **Idempotence des syncs** : index uniques sur `(store_id, external_id)`, `(ad_account_id, external_id)`, `(ad_id, date)`, etc. Les imports seront des upserts.
- **Historique des coûts** : `product_cost_history` n'est jamais mis à jour en place. Le coût unitaire et le COGS sont **figés sur la ligne de commande** au moment de la commande (`unit_cost_cents`, `cogs_kind = ACTUAL|ESTIMATED`).
- **Données journalières Meta** : seules les lignes `ad_insights_daily` sont stockées, les totaux sont toujours recalculés. N'importe quelle plage de dates est donc reconstructible. Les achats Meta sont nommés `meta_purchases` / `meta_purchase_value_cents` pour ne jamais être confondus avec nos commandes.
- **Sync reprenable** : `sync_jobs.cursor` (jsonb) stocke la pagination, ce qui permet de découper un import en lots plus courts que le timeout Vercel.
- **Index** : `workspace_id`, `(workspace_id, ordered_at)`, `(workspace_id, date)`, `product_id`, `campaign_id`, `ad_set_id`, `ad_id`, `external_id`.

## 4. Formules (lib/finance)

| Métrique | Formule |
|---|---|
| Landed cost | product + shipping + other |
| COGS d'un tier | quantité × (product + other) + shipping (par défaut quantité × shipping unitaire, surchargeable par tier) |
| Contribution d'un tier | prix − COGS − frais de paiement − TVA incluse − buffer remboursement − autres coûts variables |
| Break-even CPA (offre) | contribution |
| Break-even ROAS (offre) | prix ÷ contribution (`null` si contribution ≤ 0, offre « non viable ») |
| Total sales | gross sales + shipping facturé − remises |
| Net revenue | total sales − remboursements |
| Contribution before ads | net revenue − COGS − shipping − frais de paiement − coûts variables − taxes |
| Net profit | contribution before ads − ad spend |
| Net margin | net profit ÷ net revenue |
| ROAS | net revenue ÷ ad spend |
| POAS | contribution before ads ÷ ad spend |
| MER | total sales ÷ ad spend total (blended, indépendant de l'attribution) |
| CPA | ad spend ÷ nouveaux clients |
| Break-even CPA (réel) | contribution before ads ÷ commandes |
| AOV | total sales ÷ commandes |

Tout dénominateur nul renvoie `null`, jamais `Infinity` ni `NaN`.

**Statut d'acquisition** (`classifyHeadroom`) : il compare le CPA au break-even CPA avec le buffer de sécurité configuré (`target_cpa_buffer_bps`). Les statuts sont `HEALTHY`, `THIN`, `ABOVE_BREAK_EVEN`, `NOT_VIABLE` et `NO_DATA`. On ne colore jamais selon le seul ROAS.

**Conventions comptables** :
- Les commandes sont rattachées au jour de commande dans le fuseau du workspace.
- Les remboursements sont rattachés à la date de la commande d'origine (vue cohorte).
- Les commandes annulées sont exclues.
- Au niveau produit, les montants portés par la commande (subtotal, frais, shipping, remboursements) sont répartis au prorata de la valeur des lignes.
- Le buffer remboursement ne sert qu'aux simulations : en réel, ce sont les vrais remboursements qui sont déduits.

## 5. Routes

| Route | Statut |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` | ✅ |
| `/onboarding` | ✅ nom, devise et fuseau, Shopify (passable), Meta (passable), démo ou vide |
| `/dashboard` | ✅ 10 KPI avec comparaison à la période précédente, graphique journalier (avec vue tableau), profit par produit |
| `/orders` | ✅ liste paginée, COGS figé, frais réels ou estimés, attribution |
| `/integrations` | ✅ statut réel ; boutons Connect désactivés (phases 3, 4 et 7) |
| `/settings`, `/settings/finance` | ✅ workspace, données démo, hypothèses financières |
| `/products`, `/products/[id]` | Phase 2 |
| `/offers` | Phase 2 |
| `/ads` | Phases 4 et 5 |
| `/profit`, `/profit/products` | Phase 5 |
| `/insights`, Today's Actions | Phase 6 |
| `/api/webhooks/shopify/*`, `/api/cron/sync` | Phases 3 et 4 |

## 6. Sécurité

- Les Server Actions bénéficient de la protection CSRF intégrée de Next (vérification Origin/Host) et revalident systématiquement la session et le rôle (`hasRole(ctx, "ADMIN")`).
- `safeRedirectPath()` bloque les open redirects via `?next=`.
- Aucun message d'erreur brut n'est montré : les erreurs Supabase sont traduites et les error boundaries n'affichent qu'un digest.
- Le reset password répond de la même façon que le compte existe ou non (pas d'énumération).
- Les tokens OAuth seront chiffrés en AES-256-GCM (`lib/security/crypto.ts`, testé) et ne sont jamais sélectionnés dans les requêtes d'affichage.
- En-têtes : `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. HSTS est géré par Vercel.
- Rate limiting : il est assuré par Supabase Auth sur l'authentification. Pour les futurs endpoints sensibles (webhooks, sync manuelle), prévoir Upstash Ratelimit ou le WAF Vercel, car un compteur en mémoire est inefficace en serverless.

## 7. Risques liés aux APIs tierces

| API | Risque | Parade prévue |
|---|---|---|
| **Shopify** | Une app publique doit passer la revue Shopify et les données clients protégées (protected customer data) exigent une demande d'accès. Les scopes `read_orders` ne couvrent que 60 jours sans `read_all_orders`. Le rate limit est par coût GraphQL (leaky bucket). Les webhooks doivent répondre en moins de 5 s. | Démarrer en app custom / dev store. Demander `read_all_orders`. Lire `extensions.cost.throttleStatus`, faire un backoff, utiliser les bulk operations pour l'historique. Webhooks : vérifier le HMAC, puis enqueue et répondre immédiatement. |
| **Meta Marketing API** | App Review pour `ads_read` (ou accès standard). Tokens longue durée de 60 jours, ou System User. Les insights sont asynchrones pour les gros volumes et les données des derniers jours sont révisées (fenêtres d'attribution). Rate limits par compte publicitaire. Les conversions sont modélisées et sur-déclarées. | Re-sync glissante des 3 à 7 derniers jours. Jobs d'insights asynchrones. Stocker `meta_purchases` séparément de nos commandes. Ne jamais présenter l'attribution Meta comme certaine. |
| **AliExpress** | L'API officielle (Open Platform, Affiliate ou Dropshipping) exige une app approuvée. La couverture des champs varie (frais de port par pays, variantes). Le scraping est fragile et contraire aux CGU. | Interface `SupplierProvider` avec implémentation API et repli manuel : chaque coût porte `source = API | MANUAL` et aucune valeur manquante n'est inventée. |
| **Attribution UTM** | Les UTM peuvent manquer (navigateurs in-app, redirections) et `fbclid` n'est pas toujours conservé par Shopify. | Recommander `utm_campaign={{campaign.id}}&utm_content={{ad.id}}`. Mapping configurable. Statuts de confiance `DIRECT_MATCH`, `UTM_MATCH`, `INFERRED` et `UNATTRIBUTED`. |
| **Vercel** | Timeout des fonctions (selon le plan) et Cron limité sur le plan Hobby. | Jobs découpés avec curseur reprenable. Passage possible à une queue (Inngest, QStash ou Vercel Queues) sans changer le modèle `sync_jobs`. |
