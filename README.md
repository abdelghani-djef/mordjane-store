# Mordjane Store

An online shop for the CEBON / El Mordjene range of spreads and pastry ingredients: hazelnut, cocoa and peanut creams, crunchy "rocher" spreads, glazing pastes, and baking essentials (assila, s'men, vanilla, baking powder, cocoa, cornstarch, icing sugar, whipped cream powder, trimoline).

Built for Tunisia: prices are in **Tunisian dinars** (3 decimals, e.g. `12,500 DT`), and delivery is priced per **governorate** (wilaya). Customers also pick their **delegation** (mu'tamadiya), so every address is pinned to one of the 279 delegations of the 24 governorates.

- **Products come in sizes, identified by weight.** For example, 200 g, 600 g or 2.5 kg. Each size has its own price, stock and photo, and each can be switched off on its own. A product can't have two sizes of the same weight.
- **Product pages** show the net weight, price per kg, shelf life, storage and ingredients, like a data sheet.
- **Customers** browse by category, pick a size, fill a cart, and check out as guests with **cash on delivery**. At checkout they pick their governorate, which sets the delivery fee, then their delegation within it. They then track their order with its code and their phone number.
- **Staff** validate orders, move them through delivery, manage sizes, stock and availability, edit the catalog, and manage delivery cities and fees.
- **Languages.** The shop is available in English, French and **Arabic** (right to left). The admin panel is English and French only, and `/ar/admin…` redirects to the French admin.

| Layer    | Stack                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| Backend  | FastAPI · SQLAlchemy 2 (async) · Alembic · Pydantic v2 · Python 3.14           |
| Frontend | Next.js 16 (App Router) · shadcn/ui · Tailwind v4 · next-intl · TanStack Query |
| Database | PostgreSQL 17                                                                  |
| Deploy   | Docker Compose                                                                 |

## Quick start

The shop runs as five containers:

| Container        | Image                 | Port                                    |
| ---------------- | --------------------- | --------------------------------------- |
| `mordjane-db`    | `postgres:17`         | `127.0.0.1:5434` (this machine only)    |
| `mordjane-api`   | `backend/Dockerfile`  | internal only; runs migrations on start |
| `mordjane-front` | `frontend/Dockerfile` | `3000` (`FRONT_PORT`)                   |
| `mordjane-mail`  | `boky/postfix`        | internal only; sends the shop's emails (see [Mail server](#mail-server)) |
| `mordjane-backup`| `postgres:17`         | none; daily database dump (see [Backups](#backups)) |

```sh
cp .env.example .env            # set POSTGRES_PASSWORD, JWT_SECRET, MAIL_DOMAIN, PUBLIC_SITE_URL
mkdir -m 700 ~/mordjane_db_backups   # where the daily backups go (only you can open it)
docker compose up -d --build    # builds the images, migrates the database, starts the shop
```

Then load the data (next section) and open:

- Shop: http://localhost:3000
- Admin panel: http://localhost:3000/fr/admin

Notes:

- **Data** lives in two named volumes: `mordjane-db-data` (Postgres) and `mordjane-media` (uploaded photos). `docker compose down` keeps them; `docker compose down -v` deletes them.
- **`BACKEND_URL`** is a build argument of the frontend image because Next.js fixes the `/api` and `/media` rewrites at build time. Rebuild `mordjane-front` if the API's address changes.
- **`COOKIE_SECURE`** defaults to `true`, so serve the shop over HTTPS behind a reverse proxy. Browsers also accept secure cookies on `http://localhost`.
- **Updating:** `git pull && docker compose up -d --build`. Migrations run when `mordjane-api` starts.

## Loading data

All commands run inside the API container. Add `-T` after `exec` when running them from a script or CI.

### Production

```sh
# 24 governorates, 279 delegations, 4 categories and the CEBON range (21 products, 64 sizes, photos)
docker compose exec mordjane-api python -m app.cli seed

# your admin account (prompts for email and password; run it again to reset a password)
docker compose exec mordjane-api python -m app.cli create-admin
```

### Demo

```sh
# everything `seed` loads, plus the demo data in backend/demo_data/
docker compose exec mordjane-api python -m app.cli seed-demo
```

The demo adds no orders. It adds:

- **A demo admin:** `demo@mordjane.local` / `demo-mordjane`.
- **Notification settings** with two staff recipients at `@mordjane.local`.
- **Stock tweaks** so the low-stock list has entries: one size out of stock, three nearly out, and one switched off.

It asks for confirmation (`--yes` skips it) and does nothing if the demo admin already exists.

> **Never run `seed-demo` on the live shop.** The demo admin's password is public in this repository. To start over with an empty database, remove only the database volume (`down -v` would also delete the photos and the mail server's DKIM key): `docker compose stop mordjane-api mordjane-backup && docker compose rm -sf mordjane-db && docker volume rm mordjane_mordjane-db-data && docker compose up -d`.

### All commands

| Command                                        | Does                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `python -m app.cli seed`                       | delivery cities, delegations and the CEBON catalogue with photos (`--force` adds missing items to a database that already has data) |
| `python -m app.cli seed-demo`                  | `seed` plus the demo admin, settings and stock tweaks (no orders)                            |
| `python -m app.cli seed-cities`                | only the governorates and delegations (adds missing ones, keeps your edits)                  |
| `python -m app.cli sync-catalog`               | apply the CEBON range to an existing shop (see [Catalogue](#catalogue))                      |
| `python -m app.cli create-admin`               | create an admin, or reset their password                                                     |
| `alembic upgrade head`                         | run migrations by hand (`mordjane-api` already does this on start)                           |

Prefix each with `docker compose exec mordjane-api`.

The demo files are plain JSON, so you can edit them:

| File                                         | Contents                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `backend/demo_data/admins.json`              | the demo admin                                                           |
| `backend/demo_data/notification_settings.json` | staff recipients and email switches                                    |
| `backend/demo_data/stock.json`               | stock and availability overrides per size                                |

Product sizes are referenced by product slug and weight.

## Emails

The shop emails customers and staff. Customers give their email at checkout, and it's required.

| Email | To | Default |
| --- | --- | --- |
| Order confirmation: items, totals, order code, tracking link | customer | on |
| Order validated / shipped | customer | off |
| Order delivered / cancelled | customer | on |
| New order, with full details and a link to it in the admin | staff | on |
| Every status change, with the staff note | staff | on |
| Low stock: a size drops to the threshold (sent once per crossing, not on every sale) | staff | on |

- **Admin → Notifications** controls all of it: the staff recipients (sent nothing until you add some), their language, which events send email, and the low-stock threshold, which also drives the dashboard and product lists. It also has a **Send test email** button.
- **Customer emails** use the language the customer shopped in: FR, EN or AR. Arabic emails are laid out right to left. Staff emails use the staff language set under Notifications (EN or FR).
- **Staff notes** on status changes are never shown to customers.
- **Sending never slows down or breaks checkout.** Emails go out in the background right after the order is saved. If the mail server is down, the failure is logged and the order still goes through.

### Mail server

`mordjane-mail` is a Postfix server that delivers the shop's emails itself and signs them with DKIM. Only the other containers can use it; it has no port on the host and accepts no incoming mail. In `.env`:

| Variable | Example | Notes |
| --- | --- | --- |
| `MAIL_DOMAIN` | `mordjane.tn` | **required**; the server only sends as `…@MAIL_DOMAIN` |
| `MAIL_FROM` | `Mordjane <noreply@mordjane.tn>` | defaults to `noreply@MAIL_DOMAIN`; the shop only sends, nobody reads replies |
| `MAIL_HOSTNAME` | `mail.mordjane.tn` | defaults to `mail.MAIL_DOMAIN`; must match the reverse DNS below |
| `PUBLIC_SITE_URL` | `https://mordjane.tn` | base for the tracking and admin links in emails |
| `MAIL_ENABLED` | `true` | `false` logs emails instead of sending them |

**DNS records.** Without these, Gmail, Outlook and others put the shop's mail in spam or refuse it. Replace `mordjane.tn` and `203.0.113.10` with your domain and your server's IP:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `mail.mordjane.tn` | `203.0.113.10` |
| `TXT` | `mordjane.tn` | `v=spf1 a:mail.mordjane.tn -all` |
| `TXT` | `mail._domainkey.mordjane.tn` | the DKIM key: `docker compose exec mordjane-mail cat /etc/opendkim/keys/mordjane.tn.txt` |
| `TXT` | `_dmarc.mordjane.tn` | `v=DMARC1; p=quarantine; rua=mailto:you@mordjane.tn` |
| `PTR` (reverse DNS) | `203.0.113.10` | `mail.mordjane.tn`, set in your hosting provider's panel, not at your DNS registrar |

- **The DKIM key** is generated on first start and kept in the `mordjane-mail-dkim` volume. Publish it once. If you delete that volume, a new key is generated and you must update the DNS record.
- **Outgoing port 25 must be open.** Many hosts (AWS, Google Cloud, Azure, DigitalOcean, Hetzner for new accounts…) block it by default; ask their support to open it. If they won't, set `RELAYHOST`, `RELAYHOST_USERNAME` and `RELAYHOST_PASSWORD` in `.env` to hand the mail to a provider (Brevo, Mailgun, Amazon SES…), which then needs its own SPF and DKIM records.
- **Check it:** send yourself a message from **Admin → Notifications → Send test email**, open it in Gmail and choose *Show original*: SPF, DKIM and DMARC should all say `PASS`. `docker compose logs mordjane-mail` shows each delivery (`status=sent`) or why it failed.
- **Undelivered mail** waits in the `mordjane-mail-queue` volume and Postfix keeps retrying, so a restart loses nothing.

To skip `mordjane-mail` and send through a provider directly instead, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_STARTTLS` / `SMTP_SSL` and `SMTP_USERNAME` / `SMTP_PASSWORD` in `.env`; they override the defaults that point at `mordjane-mail`.

## How it fits together

```
browser ──► mordjane-front :3000 ──rewrite /api/*, /media/* ──► mordjane-api :8000 ──► mordjane-db :5432
              │ server components fetch FastAPI directly (BACKEND_URL, no-store)
```

- **Same origin.** The browser only talks to Next.js, so the admin session cookie (httpOnly JWT) is first-party and CORS isn't needed. `src/proxy.ts` handles locale routing and skips `/api` and `/media`.
- **Shop pages** are server-rendered on every request, which keeps stock and availability live. `next build` never needs the backend.
- **The admin panel** is a client app, built on TanStack Query and the typed contracts in `src/lib/api-types.ts`.
- **Business rules** live in `backend/app/services/orders.py`:
  - Placing an order requires an active governorate and an active delegation of that governorate. The governorate's fee is added to the order. The governorate and delegation names and the fee are snapshotted, so later edits never rewrite past orders.
  - Order lines point at a size. Placing an order locks those sizes' rows (`SELECT … FOR UPDATE`).
  - Prices are recomputed on the server, and stock is decremented in the same transaction. Two customers can never both buy the last unit. Each line snapshots the product name and weight.
  - Status moves `pending → validated → shipped → delivered`. `cancelled` is allowed from any open state and returns the stock to the sizes that were ordered.
  - Every change is logged as a timeline event. Staff can add an internal note, which customers never see.
- **Stock edits are guarded.** The admin sends the stock figure it last saw. If orders changed it in the meantime, the edit is refused with the new figure rather than silently overwriting sales.
- **Product images.** Each product has a listing photo, and each size can have its own (the 200 g jar, the 12 kg bucket…): the product page switches photo with the size, and the cart shows the pack that was picked. Admins upload them on the product page. The server sniffs the file type from its magic bytes (JPEG, PNG, WebP or GIF; 5 MB max) and stores it in `MEDIA_DIR`. Without any photo, the product is drawn in a container filled with its colour, sized to the weight.

## Arabic storefront

- **Routing.** `/ar/…` serves the shop right to left: `<html dir="rtl">`, plus a Radix `DirectionProvider` so menus, selects and scroll areas mirror too. Components use logical classes (`ms-*`, `pe-*`, `start-*`), and directional icons flip with `rtl:rotate-180`. Phone, email and order-code fields stay left to right.
- **Fonts.** Baloo Bhaijaan 2 (headings) and Noto Sans Arabic (text) are vendored in `src/fonts` under the OFL. They sit after the Latin fonts in the font stacks and are limited to the Arabic unicode range, so English and French pages never download them.
- **Numbers** use Western digits with Tunisian separators: `12,500 د.ت`, `200 غ`, `2,5 كغ`.
- **Translations.** Interface copy lives in `messages/ar.json`, and any key missing there falls back to French.
- **Catalogue copy.** Products, categories and delivery cities have optional Arabic fields, editable in the admin panel. An empty Arabic field shows the French text instead. The seeded catalogue comes with the supplier's Arabic copy, and `seed` fills Arabic names for the categories and the 24 governorates without touching fields you have already edited.
- **Orders** remember the language they were placed in. Staff see it on the order page ("Ordered in Arabic"), and the customer's emails follow it.

## Catalogue

The catalogue is the CEBON range (cebon.dz): 21 products and 64 sizes, with the supplier's French, English and Arabic descriptions, ingredients, shelf lives, and a 1024 px packshot per size. It lives in `backend/app/seed_catalog.py`, with the photos in `backend/seed_media/products/`.

- **New database:** `seed` loads it.
- **Existing shop:** `sync-catalog` applies it without losing sales history. It adds missing products and sizes, and refreshes names, descriptions, ingredients and photos. It keeps the prices, stock and availability you set on existing sizes. Products and sizes outside the range are switched off, never deleted, so past orders stay intact. It's safe to run again.
- The glazing pastes come in seven flavours of 250 g, so each flavour is its own product. The supplier lists two 900 g s'men tubs; since a size is its weight, the shop keeps one.


Governorates, their fees and their delegations are data, managed in the admin panel rather than in config. The delegation list is the 2024 census list (279 delegations, from Wikipedia's « Délégation (Tunisie) »), with English and Arabic names from Wikidata; it lives in `backend/app/seed_delegations.py`.


Backend settings (`backend/app/config.py`) come from environment variables. Set them in `.env` (see `.env.example`); `docker-compose.yml` sets the ones that depend on the containers.

| Variable             | In Docker                                  | Notes                                    |
| -------------------- | ------------------------------------------ | ---------------------------------------- |
| `POSTGRES_PASSWORD`  | **required**                               | also `POSTGRES_DB` / `POSTGRES_USER` (default `mordjane`) |
| `DATABASE_URL`       | built from the `POSTGRES_*` values         | points at `mordjane-db`                  |
| `JWT_SECRET`         | **required**                               | a long random value: `openssl rand -hex 32` |
| `COOKIE_SECURE`      | `true`                                     | needs HTTPS (or `http://localhost`)      |
| `CURRENCY`           | `TND`                                      | the UI label is `NEXT_PUBLIC_CURRENCY_LABEL` (`DT`); amounts use 3 decimals |
| `LOW_STOCK_THRESHOLD`| `5`                                        | starting value only; admins change it under Notifications |
| `MEDIA_DIR`          | `/data/media` (volume `mordjane-media`)    | uploaded images                           |
| `BACKEND_URL`        | `http://mordjane-api:8000` (build arg)     | read by Next.js for rewrites + server fetches |
| `FRONT_PORT`         | `3000`                                     | host port of the shop                    |

## Tests & checks

```sh
# backend: 85 tests against a throwaway Postgres (needs uv and Python 3.14)
docker run -d --rm --name mordjane-testdb -p 127.0.0.1:5445:5432 \
  -e POSTGRES_USER=mordjane -e POSTGRES_PASSWORD=mordjane -e POSTGRES_DB=mordjane_test postgres:17
(cd backend && TEST_DATABASE_URL=postgresql+asyncpg://mordjane:mordjane@127.0.0.1:5445/mordjane_test \
  uv run pytest && uv run ruff check . && uv run ruff format --check .)
docker stop mordjane-testdb
# covers: server-side pricing, oversell 409, concurrent last-unit race,
# status transitions, cancel restock, auth, uploads, delivery-city fees & rules,
# emails (languages, RTL Arabic, switches, low stock), demo data

# frontend
(cd frontend && npm run lint && npm run typecheck && npm run build)

# end-to-end, against a running shop with `seed` and an admin
(cd frontend && npx playwright install chromium && npm run e2e)
# E2E_BASE_URL (http://127.0.0.1:3000), E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, and
# E2E_MAILPIT_URL: the email checks read a Mailpit inbox the shop's SMTP must point at
```

## Schema changes

```sh
cd backend
# edit app/models.py, then:
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
uv run alembic check          # model ↔ migration drift
```

If the API changed, refresh the frontend types with `cd frontend && BACKEND_URL=<api address> npm run gen:api`. In Docker the API has no host port; for example, run `docker compose exec -T mordjane-api python -c "import json; from app.main import app; print(json.dumps(app.openapi()))" > /tmp/openapi.json` and point `openapi-typescript` at that file.

## Backups

`mordjane-backup` dumps the database every day at **midnight (Tunis time)** to `~/mordjane_db_backups` on the host, as `mordjane-YYYY-MM-DD.dump`, and deletes dumps older than 14 days. The dumps are compressed `pg_dump` files and hold customer names, phones and addresses, so keep the folder private and copy it off the server regularly.

```sh
docker compose logs mordjane-backup     # "backup done: …" after each run

# back up right now
docker compose exec mordjane-backup sh -c 'pg_dump --format=custom --file=/backups/mordjane-$(date +%F-%H%M).dump'

# restore a dump (replaces the current data)
docker compose stop mordjane-api
docker compose exec mordjane-backup pg_restore --clean --if-exists --no-owner -d mordjane /backups/mordjane-2026-10-18.dump
docker compose up -d
```

The dumps are owned by root, but you can read, copy and delete them because the folder is yours. To change the time, folder or how many days are kept, edit the `mordjane-backup` service in `docker-compose.yml`. Product photos are not in the dump; they live in the `mordjane-media` volume.

## Before going to production

- Set `POSTGRES_PASSWORD` and `JWT_SECRET` in `.env`, and serve everything over HTTPS (keep `COOKIE_SECURE=true`).
- Load data with `seed` and `create-admin`, never `seed-demo`.
- Add the mail DNS records and reverse DNS, and check that test emails pass SPF, DKIM and DMARC (see [Mail server](#mail-server)).
- Add rate limiting on `POST /api/admin/auth/login` and `POST /api/orders`, at the reverse proxy or with middleware.
- Copy `~/mordjane_db_backups` off the server regularly (see [Backups](#backups)), and back up the `mordjane-media` volume (product photos) too.
- Review product prices and stock under **Admin → Products**. The supplier doesn't publish prices, so sizes added from the CEBON range have estimated prices and placeholder stock.
- Review the delivery fees under **Admin → Delivery cities**. The seeded fees are placeholders: 7 DT for Grand Tunis, 8 DT for the north and centre, 9 DT for the south.
