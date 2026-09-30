# Getting the frontend running so your iPhone can reach it

**Why not just run it through this chat?** This assistant's shell for your computer runs inside an isolated Linux VM — separate from your Mac's real network and even its OS (Linux vs. macOS). A server started there can't be reached by your iPhone over Wi-Fi, and a native module (`better-sqlite3`) built there is a Linux binary that won't even load on real macOS. This has to run in your actual Mac Terminal.

## 1. Open Terminal.app on your Mac

Spotlight (⌘+Space) → type `Terminal` → Enter.

## 2. Install dependencies and set up the database

```bash
cd ~/Desktop/"Dynamic Dashboard"/frontend
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
```

## 3. Start the server so devices on your Wi-Fi can reach it

```bash
npm run dev -- -H 0.0.0.0
```

Leave this running. Confirm it's up: open `http://localhost:3001/dashboard` in Safari on your Mac — you should see the admin portal.

## 4. Find your Mac's LAN IP

**System Settings → Wi-Fi → Details…** (or in a second Terminal tab: `ipconfig getifaddr en0`). Your iPhone must be on the **same Wi-Fi network** as your Mac.

## 5. Point the iOS app at that IP

In Xcode: **Product → Scheme → Edit Scheme… → Run → Arguments → Environment Variables**, add:

```
API_BASE_URL = http://<your-mac-lan-ip>:3001/api/v1
```

(e.g. `http://192.168.1.23:3001/api/v1`). This is read by `AppEnvironment.live` at launch — no rebuild logic needed, just Run again.

## 6. Trust the developer certificate (first run on this iPhone only)

On the iPhone: **Settings → General → VPN & Device Management** → your developer profile → **Trust**.

## 7. Run

Hit ▶ in Xcode targeting your iPhone. It should now load the real published config from your Mac instead of hanging on the loading spinner.

---

**If it still doesn't load:** check the iPhone's Wi-Fi network name matches your Mac's exactly (not a guest network), and that no firewall on the Mac is blocking incoming connections on port 3001 (System Settings → Network → Firewall — if on, allow incoming for `node`).
