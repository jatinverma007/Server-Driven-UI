# Turso migration — how to apply

This is a **diff-only package**: the 24 files that changed to move persistence
from local `better-sqlite3` to `@libsql/client` (Turso-compatible), so the
portal can run on Vercel. It applies on top of what's already pushed to
`github.com/jatinverma007/Server-Driven-UI`.

## Apply it

```bash
cd "/Users/eroute-admin/Desktop/Dynamic Dashboard"
tar -xzvf ~/Downloads/omnicard-turso-migration.tar.gz -C frontend
cd frontend
npm install          # removes better-sqlite3, installs @libsql/client
```

## Local dev still works unchanged

`.env`'s `DATABASE_URL="file:./dev.db"` still works exactly as before —
`@libsql/client` speaks plain local SQLite files too. Nothing about your
day-to-day `npm run dev` workflow changes.

## Test against your real Turso database (do this before deploying)

Add to `.env` (don't commit this — it's already gitignored):

```
DATABASE_URL="libsql://omnicard-sdui-skypejatin07.aws-ap-south-1.turso.io"
TURSO_AUTH_TOKEN="<the token from your Turso dashboard>"
```

Then `npm run dev` and click around, or run `npm run db:seed` / `npm run
create-user -- ... `. I could not test this live myself — the container I
work in blocks outbound access to your Turso host by network policy — so
this is the one step only you can verify before we deploy.

Once you confirm it works, switch `.env` back to the local file for day-to-day
dev if you prefer, and push this migration:

```bash
git add -A
git commit -m "Migrate persistence to @libsql/client (Turso-compatible) for Vercel"
git push
```

## What changed, mechanically

Every DB call across the app is now `async`/`await` (the old
`better-sqlite3` calls were synchronous). Nothing about behavior, routes, or
the API contract changed — same tables, same columns, same request/response
shapes. Full list of touched files is in this tarball's directory structure.

## Verified in the container before packaging

- `npm run typecheck` — clean
- `npm run lint` — clean, no warnings
- `npm run test` — 75/75 passing (local `file:` SQLite mode)
- `npm run build` — succeeds, all routes compile

Not verified: live read/write against the real remote Turso database (see
above — blocked by this container's network policy, not a code issue).
