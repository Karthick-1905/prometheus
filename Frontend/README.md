# CAT Smart Rental — Frontend (RBAC mock)

Vite + React SPA with **role-based workspaces**. Authentication is simulated via a role selector (no JWT / passwords).

## Run

```powershell
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173 → **Select role → Continue**.

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
