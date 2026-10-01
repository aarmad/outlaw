# Outlaw

Outlaw est un SaaS de rentabilité pour dropshippers. Il répond à trois questions :
**Combien est-ce que je gagne réellement ? Quel est le CPA maximum que je peux payer ?
Quels produits, offres et campagnes contribuent réellement à mon profit ?**

Stack : Next.js 16 · TypeScript · Tailwind 4 · shadcn/ui · Supabase (Postgres + Auth) · Drizzle · Vitest · Vercel.
Les choix d'architecture sont détaillés dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 1 | Fondation : auth, workspace, onboarding, mode démo, shell, dashboard | ✅ |
| 2 | Moteur financier : produits, coûts, offres, bundles, break-even | 🟡 moteur et tests faits, écrans à venir |
| 3 | Shopify (OAuth, sync, webhooks) | ⏳ |
| 4 | Meta Ads | ⏳ |
| 5 | Profit analytics et attribution | ⏳ |
| 6 | Insights et Today's Actions | ⏳ |
| 7 | Import AliExpress | ⏳ |

---

## 1. Installation locale

Prérequis : Node.js ≥ 20.11 et un projet Supabase (gratuit), ou Supabase en local via la CLI et Docker.

```bash
npm install
cp .env.example .env.local   # utilisé par Next.js
cp .env.example .env         # utilisé par drizzle-kit (migrations)
```

## 2. Variables d'environnement

Elles sont décrites dans [.env.example](.env.example).

| Variable | Où la trouver | Exposée au navigateur ? |
|---|---|---|
| `APP_URL` | URL de l'app (`http://localhost:3000` en local) | non |
| `DATABASE_URL` | Supabase → Connect → **Transaction pooler** (port 6543) | non |
| `DIRECT_DATABASE_URL` | Supabase → Connect → **Session pooler** (port 5432), utilisé pour les migrations | non |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | oui (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → publishable (ou anon) | oui (public, RLS deny-all) |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | non |
| `CRON_SECRET` | chaîne aléatoire de 32 caractères ou plus | non |

Ne mettez jamais la clé `service_role` / secret de Supabase dans une variable `NEXT_PUBLIC_*`. L'app n'en a pas besoin.

### Option rapide : Supabase en local (Docker)

```bash
npx supabase start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,studio,postgres-meta,supavisor
npx supabase status -o env      # affiche API_URL, DB_URL et PUBLISHABLE_KEY
```

Dans `.env.local` et `.env` :
- `DATABASE_URL` et `DIRECT_DATABASE_URL` reçoivent `postgresql://postgres:postgres@127.0.0.1:54322/postgres` ;
- `NEXT_PUBLIC_SUPABASE_URL` reçoit `http://127.0.0.1:54321` ;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reçoit la `PUBLISHABLE_KEY` affichée ;
- `APP_URL` reçoit l'URL de `next dev`.

En local, la confirmation par e-mail est désactivée ([supabase/config.toml](supabase/config.toml)) et tous les ports `localhost` sont autorisés comme callback. Les e-mails, notamment ceux de reset password, arrivent dans Mailpit : http://127.0.0.1:54324.

## 3. Création de la base

1. Créez un projet sur [supabase.com](https://supabase.com) et choisissez une région proche de votre région Vercel.
2. Copiez les deux chaînes de connexion (transaction et session) dans `.env` et `.env.local`.

## 4. Migrations

```bash
npm run db:migrate      # applique drizzle/*.sql (utilise DIRECT_DATABASE_URL)
```

Après une modification de `lib/db/schema.ts` :

```bash
npm run db:generate -- --name <description>   # génère une nouvelle migration SQL
npm run db:migrate
```

Toutes les tables ont RLS activé sans policy. L'app accède à la base via la connexion serveur, et la Data API publique de Supabase ne voit rien.

## 5. Lancement

```bash
npm run dev           # http://localhost:3000
npm run check         # typecheck + lint + tests
npm run build         # build de production
```

Dans Supabase, sous **Authentication → URL Configuration** :
- Site URL : `http://localhost:3000`
- Redirect URLs : `http://localhost:3000/auth/callback`

En développement, vous pouvez désactiver *Confirm email* (Authentication → Providers → Email) pour vous connecter tout de suite après l'inscription.

Une fois connecté, l'onboarding propose **Use demo data** : 3 produits, 5 campagnes, 10 ad sets, 20 ads, environ 300 commandes sur 30 jours. Ces données peuvent être régénérées ou supprimées dans **Settings**, sans toucher à vos propres données.

### Tests

```bash
npm test
```

- `tests/finance/` : break-even CPA et ROAS, profit, marge, POAS, MER, remboursements, COGS de bundle, TVA, arrondis, dénominateurs nuls.
- `tests/demo/` : cohérence du jeu de démo (COGS historique, scénario attendu).
- `tests/integration/` : migrations et SQL réels sur Postgres (PGlite, en mémoire, sans Docker). Les agrégats du dashboard doivent égaler exactement les totaux calculés indépendamment, et l'isolation entre workspaces est vérifiée.
- `tests/security/` : chiffrement des tokens, redirections sûres.

## 6. Shopify : configuration (phase 3)

Pas encore branché. Ce qu'il faudra préparer :
1. Créer une app dans le [Shopify Partner Dashboard](https://partners.shopify.com).
2. App URL : `https://<votre-domaine>`. Redirect URL : `https://<votre-domaine>/api/integrations/shopify/callback`.
3. Scopes prévus : `read_orders`, `read_all_orders` (sur demande), `read_products`.
4. Renseigner `SHOPIFY_CLIENT_ID` et `SHOPIFY_CLIENT_SECRET`.

## 7. Meta : configuration (phase 4)

1. Créer une app de type *Business* sur [developers.facebook.com](https://developers.facebook.com).
2. Ajouter *Facebook Login for Business* et l'API *Marketing*. Permissions : `ads_read`, `business_management`.
3. Valid OAuth Redirect URI : `https://<votre-domaine>/api/integrations/meta/callback`.
4. Renseigner `META_APP_ID` et `META_APP_SECRET`.

## 8. AliExpress : configuration (phase 7)

L'API officielle passe par l'[AliExpress Open Platform](https://openservice.aliexpress.com) et nécessite une app approuvée. Sans credentials, l'import fonctionnera en mode manuel : URL analysée, puis coûts saisis par l'utilisateur et marqués `MANUAL`. Variables : `ALIEXPRESS_APP_KEY` et `ALIEXPRESS_APP_SECRET`.

## 9. Déploiement sur Vercel

1. Poussez le dépôt sur GitHub, puis importez-le dans Vercel (le framework Next.js est détecté et la commande de build reste `next build`).
2. Dans **Project Settings → Environment Variables**, ajoutez toutes les variables de la section 2 (avec `APP_URL=https://<votre-domaine>`).
3. Appliquez les migrations sur la base de production **avant** le premier déploiement, depuis votre poste ou une CI :
   ```bash
   DIRECT_DATABASE_URL="<url session prod>" npm run db:migrate
   ```
   Les migrations ne tournent volontairement pas pendant le build Vercel, pour qu'un déploiement de preview ne puisse pas modifier la base de production.
4. Dans Supabase, sous Authentication → URL Configuration, mettez Site URL à `https://<votre-domaine>` et ajoutez `https://<votre-domaine>/auth/callback` aux Redirect URLs (ainsi que `https://*-<team>.vercel.app/auth/callback` pour les previews).
5. Vercel Cron (synchronisations, phase 3) : un `vercel.json` appellera `/api/cron/sync` avec l'en-tête `Authorization: Bearer $CRON_SECRET`.

## 10. URLs de callback OAuth

| Fournisseur | Callback |
|---|---|
| Supabase Auth (e-mails) | `https://<domaine>/auth/callback` |
| Shopify | `https://<domaine>/api/integrations/shopify/callback` |
| Meta | `https://<domaine>/api/integrations/meta/callback` |

En local, remplacez `https://<domaine>` par `http://localhost:3000`. Shopify impose HTTPS : utilisez un tunnel, par exemple `cloudflared` ou `ngrok`.
