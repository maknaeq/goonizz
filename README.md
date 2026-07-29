# Goonizz

API du quiz (Node.js/TypeScript, Express, TypeORM, PostgreSQL), containerisée avec Docker et automatisée avec GitHub Actions.

## Sommaire

- [Travailler en local](#travailler-en-local)
- [Reproduire la production en local](#reproduire-la-production-en-local)
- [Environnements](#environnements)
- [CI/CD : déclencheurs et effets de bord](#cicd--déclencheurs-et-effets-de-bord)
- [Ce à quoi faire attention](#ce-à-quoi-faire-attention)

## Travailler en local

```bash
docker compose up --build
```

Ça lance deux services sur un réseau Docker dédié (`app-network`) :
- `db` : PostgreSQL, port `5432` publié sur l'hôte
- `api` : l'app, port `3000` publié sur l'hôte, build stage `dev` (voir plus bas), avec le dossier du projet monté en volume → **live-reload** actif (`nodemon` + `ts-node`), toute modification de `src/` redémarre le serveur automatiquement

L'API n'attend pas juste que le container Postgres soit lancé : `depends_on` utilise `condition: service_healthy`, donc `api` ne démarre qu'une fois le `healthcheck` (`pg_isready`) de `db` au vert — évite une erreur de connexion au boot.

Tester l'API : les requêtes sont dans `bruno/Goonizz` (collection [Bruno](https://www.usebruno.com/)), environnement `Local`. En CLI :
```bash
cd bruno/Goonizz
npx @usebruno/cli run --env Local -r --exclude-tags ws
```
(`--exclude-tags ws` exclut les 2 requêtes WebSocket, que le CLI headless ne supporte pas — à tester manuellement dans l'app Bruno desktop, ou via `node scripts/e2e.mjs` avec la stack lancée).

## Reproduire la production en local

```bash
docker compose -f compose.prod.yml up
```

Contrairement à `compose.yml`, ce fichier n'a **aucune clause `build`** : `api` tourne depuis l'image déjà compilée et publiée sur `ghcr.io/maknaeq/goonizz` par la CI, pas depuis le code local. C'est le stage `runtime` du `Dockerfile` (voir plus bas) — pas de `nodemon`/`ts-node`, juste `node dist/index.js`.

## Environnements

| Environnement | Où | Image utilisée | Rôle |
|---|---|---|---|
| Local | poste de dev | buildée en local (`compose.yml`, stage `dev`) | développement avec live-reload |
| Staging (`dev`) | serveur de recette (ou local via `compose.prod.yml`) | `ghcr.io/maknaeq/goonizz:dev` | valider une évolution avant `main`, mise à jour automatique par Watchtower |
| Production (`main`) | — | `ghcr.io/maknaeq/goonizz:latest` | version stable |

Chaque image porte aussi un tag `sha-<commit>` (toujours généré), pour retrouver/rollback vers une version précise.

## CI/CD : déclencheurs et effets de bord

### `.github/workflows/tests.yml` — Tests
- **Déclencheur** : `push` sur n'importe quelle branche, et `pull_request` vers `main`
- **Effet** : lance la stack `compose.yml` (API + Postgres) sur le runner, exécute la collection Bruno contre `http://localhost:3000`. Échec → le check `bruno-tests` passe au rouge.

### `.github/workflows/docker-build.yml` — Build and push Docker image
- **Déclencheur** : `push` sur `main` ou `dev` uniquement
- **Effet** : build le stage `runtime` du `Dockerfile`, le pousse sur `ghcr.io/maknaeq/goonizz` avec les tags :
  - `latest` — uniquement si la branche est la branche par défaut (`main`)
  - `dev` — uniquement si la branche est `dev`
  - `sha-<commit>` — toujours

### Protection de branche `main`
Ruleset actif sur GitHub : PR obligatoire (pas de push direct), et le check `bruno-tests` doit être vert avant de pouvoir merger.

### Watchtower — CD (polling)
- **Déclencheur** : toutes les 5 minutes (`compose.watchtower.yml`), Watchtower interroge `ghcr.io` pour les containers portant le label `com.centurylinklabs.watchtower.enable=true` (seul `api` l'a — pas `db`)
- **Effet** : si une nouvelle image `:dev` existe (poussée par `docker-build.yml`), Watchtower la télécharge et redémarre le container automatiquement, sans action humaine → c'est du *Continuous Delivery* automatique vers l'environnement de recette, en approche *polling* (pas de webhook possible ici, l'infra tourne en local/sans exposition publique). Le passage recette → prod (`dev` → `main`) reste lui manuel, via la PR à merger : c'est le point de bascule humain entre delivery et un éventuel deployment complet.
- **Notifications** : optionnelles, via `WATCHTOWER_NOTIFICATION_URL` (format [shoutrrr](https://nicholas-fedor.github.io/shoutrrr/services/overview/), ex. Discord). Créer un fichier `.env` à la racine (ignoré par git, voir `.env.example`) avec `WATCHTOWER_NOTIFICATION_URL=discord://TOKEN@WEBHOOKID` — sans ce fichier, Watchtower tourne normalement sans rien notifier (`Using no notifications`).

### `concurrency` sur les workflows
`tests.yml` et `docker-build.yml` annulent automatiquement un run en cours si un nouveau push arrive sur la même branche/PR (`concurrency.cancel-in-progress`) — évite de consommer des minutes CI pour un résultat qui sera de toute façon remplacé.

Chaîne complète pour une évolution sur `dev` : `push` → `tests.yml` teste → `docker-build.yml` build+push l'image `:dev` (si sur `dev`/`main`) → Watchtower la détecte sous 5 min et relance `api` avec la nouvelle version, en local via `compose.prod.yml` + `compose.watchtower.yml`.

## Ce à quoi faire attention

- **`host: "db"` codé en dur** dans `src/datasource.ts` — l'API ne peut se connecter à Postgres que dans le réseau Docker Compose (résolution DNS par nom de service). Pas d'exécution de l'API hors Docker sans adapter ce paramètre.
- **`compose.yml` build le stage `dev`** du `Dockerfile` (`target: dev`) — c'est ce qui permet le live-reload. Si `target` est retiré, Compose build le dernier stage (`runtime`), qui n'a ni `nodemon` ni le code source : le live-reload casse silencieusement.
- **Ne pas casser les tests Bruno avant de merger sur `main`** — le check est requis, la PR reste bloquée sinon (`bruno/Goonizz`, dossiers `User → Quizz → Cleanup → Pentest`, l'ordre des `seq` compte : `Cleanup/Sign Out` doit tourner entre `Quizz` et `Pentest`).
- **Watchtower ne surveille que les services labellisés** — ajouter un nouveau service à `compose.prod.yml` sans le label `com.centurylinklabs.watchtower.enable=true` veut dire qu'il ne sera jamais mis à jour automatiquement.
- **Le tag `latest` est réservé à `main`** — ne jamais s'appuyer dessus pour tester une évolution en cours, utiliser `:dev` ou `:sha-<commit>`.
