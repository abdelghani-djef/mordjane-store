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
| Dev env  | [devenv](https://devenv.sh) (Nix)                                              |

## Quick start

```sh
devenv up -d     # Postgres :5433, FastAPI :8000 (runs migrations), Next.js :3000, Mailpit :8025
devenv shell     # toolchain + helper scripts below
seed             # 24 governorates + 279 delegations, categories and the CEBON catalogue
create-admin     # prompts for email + password (re-run to reset a password)
```

- Shop: http://localhost:3000
- Admin panel: http://localhost:3000/en/admin
- Test inbox (every email the shop sends locally): http://localhost:8025
- API docs: http://127.0.0.1:8000/docs

On entering the shell, devenv installs both dependency sets:
- `uv sync` puts the backend's packages into `.devenv/state/venv`.
- `npm install` sets up `frontend/`.

Postgres uses port **5433** because a system Postgres already occupies 5432.

### Helper scripts (inside `devenv shell`)

| Script         | Does                                                          |
| -------------- | ------------------------------------------------------------- |
| `migrate`      | `alembic upgrade head`                                        |
| `seed`         | load delivery cities + the CEBON catalogue with photos (`--force` adds missing items to a non-empty DB) |
| `sync-catalog` | apply the CEBON range to an existing shop (see [Catalogue](#catalogue)) |
| `seed-cities`  | load only the 24 governorates and their 279 delegations (safe for production; adds missing ones, keeps your edits) |
| `create-admin` | create an admin / reset their password                        |
| `gen-api`      | regenerate `frontend/src/lib/api-types.ts` from the running API's OpenAPI schema |

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

### Testing locally with Mailpit

`devenv up` also starts **[Mailpit](https://mailpit.axllent.org)**, a fake mail server. It catches everything on SMTP port 1025 and shows it at **http://localhost:8025**, and nothing is delivered to real inboxes, so any address works. To try it:

1. Place an order in the shop.
2. Open http://localhost:8025 to see the confirmation, plus the staff email if you've added recipients.
3. Change the order's status in the admin panel to trigger the status emails.

The end-to-end tests read Mailpit's API to check that the confirmation and "delivered" emails arrive.

### Production SMTP

Point these environment variables at your mail provider (Brevo, Mailgun, Amazon SES, Gmail/Google Workspace, your host's SMTP…):

| Variable | Example | Notes |
| --- | --- | --- |
| `SMTP_HOST` | `smtp-relay.brevo.com` | |
| `SMTP_PORT` | `587` | 587 with STARTTLS, or 465 with SSL |
| `SMTP_STARTTLS` / `SMTP_SSL` | `true` / `false` | match the port |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | provider credentials | |
| `MAIL_FROM` | `Mordjane <commandes@mordjane.tn>` | use a domain your provider has verified (SPF/DKIM), or mail lands in spam |
| `PUBLIC_SITE_URL` | `https://mordjane.tn` | base for the tracking and admin links in emails |
| `SMTP_HELO_HOSTNAME` | optional | defaults to the `MAIL_FROM` domain |
| `MAIL_ENABLED` | `true` | `false` logs emails instead of sending them |

## How it fits together

```
browser ──► Next.js :3000 ──rewrite /api/*, /media/* ──► FastAPI :8000 ──► Postgres :5433
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


Backend settings (`backend/app/config.py`) come from environment variables; devenv sets the dev values.

| Variable             | Default (dev)                        | Notes                                    |
| -------------------- | ------------------------------------ | ---------------------------------------- |
| `DATABASE_URL`       | `postgresql+asyncpg://…:5433/mordjane` |                                        |
| `JWT_SECRET`         | dev value                            | **set a long random value in production** |
| `COOKIE_SECURE`      | `false`                              | **`true` in production (HTTPS)**          |
| `CURRENCY`           | `TND`                                | the UI label is `NEXT_PUBLIC_CURRENCY_LABEL` (`DT`); amounts use 3 decimals |
| `LOW_STOCK_THRESHOLD`| `5`                                  | starting value only; admins change it under Notifications |
| `MEDIA_DIR`          | `.devenv/state/media`                | uploaded images                           |
| `BACKEND_URL`        | `http://127.0.0.1:8000`              | read by Next.js for rewrites + server fetches |

## Tests & checks

```sh
# backend: 64 tests against the mordjane_test DB
(cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .)
# covers: server-side pricing, oversell 409, concurrent last-unit race,
# status transitions, cancel restock, auth, uploads, delivery-city fees & rules,
# emails (languages, RTL Arabic, switches, low stock)

# frontend
(cd frontend && npm run lint && npm run typecheck && npm run build)

# end-to-end (needs `devenv up`, `seed` and an admin)
(cd frontend && npx playwright install chromium && npm run e2e)
# E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD default to admin@mordjane.local / choco-admin-dev

devenv test      # boots Postgres, checks toolchain versions, runs the backend suite
```

## Schema changes

```sh
cd backend
# edit app/models.py, then:
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
uv run alembic check          # model ↔ migration drift
gen-api                       # refresh frontend types if the API changed
```

## Before going to production

- Set `JWT_SECRET` and `COOKIE_SECURE=true`, and serve everything over HTTPS.
- Add rate limiting on `POST /api/admin/auth/login` and `POST /api/orders`, at the reverse proxy or with middleware.
- Put `MEDIA_DIR` on persistent storage, or move uploads to object storage.
- Review product prices and stock under **Admin → Products**. The supplier doesn't publish prices, so sizes added from the CEBON range have estimated prices and placeholder stock.
- Review the delivery fees under **Admin → Delivery cities**. The seeded fees are placeholders: 7 DT for Grand Tunis, 8 DT for the north and centre, 9 DT for the south.
