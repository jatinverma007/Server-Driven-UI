#!/bin/bash
# Double-click this file in Finder to set up and start the OmniCard SDUI
# backend/admin portal. Leave the Terminal window it opens running — that's
# your live server. The iOS Simulator (and this Mac's Safari) can then reach
# it at http://localhost:3001.
set -e
cd "$(dirname "$0")/frontend"

echo "== Installing dependencies (first run only takes a minute or two) =="
if [ ! -d node_modules ]; then
  npm install
else
  echo "node_modules already present, skipping npm install."
fi

echo "== Setting up environment file =="
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "== Setting up local database =="
npx prisma db push

echo "== Seeding sample data (safe to re-run) =="
npm run db:seed || true

echo
echo "======================================================"
echo " Starting the server at http://localhost:3001"
echo " Leave this window open. Press Ctrl+C to stop it."
echo "======================================================"
echo
npm run dev
