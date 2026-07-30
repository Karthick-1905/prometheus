# CAT Smart Rental — Frontend

Vite + React SPA with **role-based workspaces** and **installable Progressive Web App (PWA)** support for mobile/desktop.

## Run

```powershell
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173 → sign in → choose workspace.

### Install as mobile app (PWA)

1. **Production / HTTPS** (or `npm run build && npm run preview` locally):
2. **Android Chrome:** browser menu → **Install app** / **Add to Home screen**, or use the in-app banner / **Settings → Mobile app**.
3. **iPhone Safari:** Share → **Add to Home Screen**.
4. Launch from the home-screen icon (standalone, full-screen).

PWA is powered by `vite-plugin-pwa` (service worker + web app manifest). App shell caches offline; API calls stay network-first.

```powershell
npm run build
npm run preview
# open the preview URL on your phone (same LAN) or deploy to HTTPS host
```

## Roles & routes

| Role | Base path | Nav |
|------|-----------|-----|
| Fleet Manager | `/fleet/*` | Dashboard, Assets, Utilization, Live Telemetry, Anomaly Detection |
| Dealer | `/dealer/*` | Dashboard, Rental Ops, Inventory, Customers |
| Site Manager | `/site/*` | Dashboard, Operators, Assignment, Site Equipment |
| Operator | `/operator/*` | Dashboard, Scan QR, Assignment, History |

Common (all roles): `/profile`, `/notifications`, `/settings`

## Structure

```
src/
  context/RoleContext.tsx   # role in React context + localStorage
  types/roles.ts            # role keys, nav, route guards
  mock/data.ts              # all placeholder data (swap for APIs later)
  routes/ProtectedRoute.tsx # role gate + wrong-URL redirect
  components/layout/        # sidebar, header, RoleLayout
  components/ui/            # StatCard, Panel, badges…
  pages/fleet|dealer|site|operator|common/
```

## Auth later

Replace `RoleContext` with JWT session; keep route trees and pages. Mock modules under `src/mock/` map 1:1 to future API clients.
