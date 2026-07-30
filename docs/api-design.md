# CAT Smart Rental — Complete API Design Plan

Aligned with **HLD Architecture** (`docs/image.png`) and product PS (`docs/ps.txt`).

This document lists **all dashboard / client APIs** needed to implement:

| Client (HLD) | Primary user | Focus |
|--------------|--------------|--------|
| Dealer admin application | **Dealer** | Inventory, rental contracts, availability, billing-facing rental ops |
| Site Manager / Operator app | **Site Manager** (+ operator actions) | QR check-in/out, site equipment, site usage |
| Fleet Manager Dashboard (SSE live) | **Fleet Manager** (primary) | Fleet overview, live status, live logs, anomalies, demand, optimization |

Internal pipeline services (MQTT → ingestion → Redis → anomaly) are noted but are **not** dashboard REST unless needed for ops.

---

## 1. Roles, scope & data isolation

### 1.1 Roles

| Role | Code | Scope |
|------|------|--------|
| **Dealer** | `DEALER` | Own `dealer_id` inventory & contracts only |
| **Site Manager** | `SITE_MANAGER` | Sites under their `company_id` (optionally a subset of `site_id`s) |
| **Fleet Manager** | `FLEET_MANAGER` | Full company fleet: all rented assets, sites, contracts, ML, live stream |
| Operator (optional sub-role) | `OPERATOR` | Check-out/in actions on assigned equipment only (can fold into Site Manager for v1) |

> **Schema note:** current `UserRole` only has `FLEET_MANAGER` / `SITE_ENGINEER`.  
> Plan assumes: add `DEALER`, rename/map `SITE_ENGINEER` → `SITE_MANAGER`, optional `OPERATOR`.  
> Dealer users may live on `Dealer` rather than `Company.User` — either link `User.dealer_id` or a separate dealer auth principal.

### 1.2 Tenancy rules (every list/detail endpoint)

| Role | Row filter |
|------|------------|
| Dealer | `equipment.dealer_id = me.dealer_id` or `contract.dealer_id = me.dealer_id` |
| Site Manager | `site.company_id = me.company_id` (+ optional `site_id IN assigned_sites`) |
| Fleet Manager | `contract.company_id = me.company_id` (all sites / equipment under company rentals) |

### 1.3 Auth convention

```
Authorization: Bearer <JWT>
```

JWT claims: `sub` (user_id), `role`, `company_id?`, `dealer_id?`, `site_ids?`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Email + password → JWT + role profile |
| `POST` | `/api/v1/auth/logout` | Invalidate refresh token (if used) |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `GET` | `/api/v1/auth/me` | Current user, role, company/dealer, permissions |

---

## 2. HLD → API surface map

```
CLIENT LAYER                         CORE SERVICES                         APIs (this doc)
─────────────                        ─────────────                         ──────────────
Dealer admin          ──CRUD──►      Inventory + Contracts                 §4 Dealer
Site Manager QR       ──scan──►      Equipment Assignment Service          §5 Assignments / Check-in-out
Fleet Manager Dash    ──SSE──►       Live telemetry + alerts               §6 Fleet + §10 Live
                      ◄──notify──    Notification Service                  §9 Notifications
Scheduler             ──cron──►      Reminders (overdue / return soon)     §9 + internal jobs
IoT MQTT              ──►            Ingestion → anomaly / store           §11 (internal/ops)
Demand Forecasting    ──►            Utilization + recommend optimize      §8 Demand
Anomaly Detection     ──►            Rules + Isolation Forest              §7 Alerts / ML
```

---

## 3. Shared conventions

### 3.1 Versioning & base URL

```
https://api.example.com/api/v1
```

### 3.2 Common query params

| Param | Use |
|-------|-----|
| `page`, `pageSize` | Pagination (default 1 / 20, max 100) |
| `sort`, `order` | e.g. `sort=detectedAt&order=desc` |
| `status` | Enum filter |
| `from`, `to` | ISO-8601 time range |
| `q` | Free-text search (name, serial, site) |

### 3.3 Standard response envelopes

**List**
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "pageSize": 20, "total": 142 }
}
```

**Error**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Site Manager cannot access another company's fleet",
    "details": {}
  }
}
```

### 3.4 Live status enum (derived for UI)

Derived from latest telemetry + contract + assignment (not only `Equipment.status`):

| `liveStatus` | Meaning |
|--------------|---------|
| `WORKING` | Engine ON, on site, contract ACTIVE |
| `IDLE` | Engine ON or recent, high idle / low load |
| `OFF` | Engine OFF / no recent heartbeat |
| `IN_TRANSIT` | Moving (speed > threshold) or unassigned GPS |
| `OVERDUE` | Contract `OVERDUE` or past `expected_return` |
| `ALERT` | Open CRITICAL/WARNING anomaly |
| `MAINTENANCE` | Equipment status MAINTENANCE |
| `AVAILABLE` | Dealer stock, not rented |
| `STALE` | No telemetry beyond N minutes |

### 3.5 Real-time channels (Fleet Manager primary)

| Channel | Transport | Purpose |
|---------|-----------|---------|
| Fleet snapshot updates | **SSE** `GET /api/v1/live/fleet` | Machines, status, last telemetry |
| Live logs / telemetry stream | **SSE** `GET /api/v1/live/logs` | Rolling event feed |
| Alert push | **SSE** `GET /api/v1/live/alerts` | New anomalies + reminders |
| Optional future | WebSocket same payloads | Bidirectional (not required v1) |

HLD: *“Fleet Manager Dashboard (SSE live)”* and *“SSE or Websocket”*.

---

## 4. Dealer Admin Application APIs

**Goal:** Manage owned machines, list who rented what, track contract lifecycle, availability for new rentals.

### 4.1 Dealer profile & org

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/dealers/me` | Dealer profile | Dealer |
| `PATCH` | `/api/v1/dealers/me` | Update contact/address | Dealer |
| `GET` | `/api/v1/dealers/me/summary` | KPI: total units, rented, available, maintenance, active contracts, overdue | Dealer |

### 4.2 Inventory (Equipment)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/dealers/equipment` | List inventory (`status`, `type`, `q`) | Dealer |
| `POST` | `/api/v1/dealers/equipment` | Register machine (name, type, model, serial, daily cost, QR/RFID) | Dealer |
| `GET` | `/api/v1/dealers/equipment/{equipmentId}` | Detail + current contract summary | Dealer |
| `PATCH` | `/api/v1/dealers/equipment/{equipmentId}` | Update metadata / status (e.g. MAINTENANCE) | Dealer |
| `DELETE` | `/api/v1/dealers/equipment/{equipmentId}` | Soft-retire if not actively rented | Dealer |
| `POST` | `/api/v1/dealers/equipment/{equipmentId}/qr` | Generate / rotate QR code payload | Dealer |
| `GET` | `/api/v1/dealers/equipment/{equipmentId}/availability` | Available windows / conflict check | Dealer |

### 4.3 Rental contracts (Dealer side)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/dealers/contracts` | All contracts (`rentalStatus`, company, date range) | Dealer |
| `POST` | `/api/v1/dealers/contracts` | Create rental: company, equipment, start, expected return, daily cost snapshot | Dealer |
| `GET` | `/api/v1/dealers/contracts/{contractId}` | Contract detail + equipment + company | Dealer |
| `PATCH` | `/api/v1/dealers/contracts/{contractId}` | Extend dates, update status | Dealer |
| `POST` | `/api/v1/dealers/contracts/{contractId}/activate` | Mark ACTIVE + equipment RENTED | Dealer |
| `POST` | `/api/v1/dealers/contracts/{contractId}/complete` | Actual return, COMPLETED, equipment AVAILABLE | Dealer |
| `POST` | `/api/v1/dealers/contracts/{contractId}/mark-overdue` | Manual overdue (also done by scheduler) | Dealer |
| `GET` | `/api/v1/dealers/contracts/{contractId}/usage-summary` | Runtime/idle/fuel for billing period | Dealer |

### 4.4 Companies (customers) — read-oriented for dealer

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/dealers/companies` | Companies with active/past rentals from this dealer | Dealer |
| `GET` | `/api/v1/dealers/companies/{companyId}` | Company contact + contract counts | Dealer |

### 4.5 Dealer notifications (subset)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/dealers/notifications` | Overdue returns, extension requests, damage alerts (if shared) | Dealer |
| `POST` | `/api/v1/dealers/notifications/{id}/read` | Mark read | Dealer |

**Dealer dashboard widgets → APIs**

| Widget | API |
|--------|-----|
| Inventory counts | `GET .../dealers/me/summary` |
| Available machines | `GET .../dealers/equipment?status=AVAILABLE` |
| Active rentals | `GET .../dealers/contracts?rentalStatus=ACTIVE` |
| Overdue returns | `GET .../dealers/contracts?rentalStatus=OVERDUE` |
| Usage for invoice | `GET .../contracts/{id}/usage-summary` |

---

## 5. Site Manager / Operator App APIs

**Goal (HLD):** QR scan check-in/out → **Equipment Assignment Service**; site-local view of machines and usage.

### 5.1 Sites

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/sites` | Sites for company (Fleet Manager: all; Site Manager: assigned) | FM, SM |
| `POST` | `/api/v1/sites` | Create project site | FM |
| `GET` | `/api/v1/sites/{siteId}` | Site detail + status + counts | FM, SM |
| `PATCH` | `/api/v1/sites/{siteId}` | Update name, location, status (`ACTIVE` / `ON_HOLD` / `COMPLETED`) | FM, SM* |
| `GET` | `/api/v1/sites/{siteId}/summary` | Machines on site, open alerts, utilization 7d | FM, SM |

\*Site Manager: only own sites if multi-site scoped.

### 5.2 Equipment assignment (core HLD service)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/assignments` | List assignments (`siteId`, `status`, `contractId`) | FM, SM |
| `POST` | `/api/v1/assignments` | Assign rented equipment to a site (from ACTIVE contract) | FM, SM |
| `GET` | `/api/v1/assignments/{assignmentId}` | Assignment detail + current checkout state | FM, SM |
| `PATCH` | `/api/v1/assignments/{assignmentId}` | Reassign site / notes | FM |
| `POST` | `/api/v1/assignments/{assignmentId}/return-to-yard` | End assignment without full contract close | FM |

### 5.3 QR / RFID Check-out & Check-in (HLD: Scan QR)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `POST` | `/api/v1/checkouts/scan` | Body: `{ qrCode \| rfidTag, siteId?, action: "CHECK_OUT" \| "CHECK_IN" }` | SM, Operator |
| `POST` | `/api/v1/checkouts` | Manual checkout without scan (equipmentId, siteId, operatorId) | SM, FM |
| `POST` | `/api/v1/checkins` | Manual check-in | SM, FM |
| `GET` | `/api/v1/checkouts/active` | Currently checked-out units at site | SM, FM |
| `GET` | `/api/v1/equipment/by-qr/{qrCode}` | Resolve QR → equipment + contract + allowed actions | SM, Operator |
| `GET` | `/api/v1/equipment/by-rfid/{rfidTag}` | Same for RFID | SM, Operator |

**Checkout scan success payload (example)**
```json
{
  "action": "CHECK_OUT",
  "assignmentId": 42,
  "equipment": { "equipmentId": 1, "name": "Excavator-01", "type": "Excavator" },
  "site": { "siteId": 3, "siteName": "North Pit" },
  "operatorId": "OP101",
  "checkoutTime": "2026-07-30T10:15:00Z",
  "warnings": ["Return due in 2 days"]
}
```

### 5.4 Site usage & logs (site-scoped)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/sites/{siteId}/equipment` | Machines currently on site + liveStatus | SM, FM |
| `GET` | `/api/v1/sites/{siteId}/usage` | Aggregated runtime / idle / fuel (`from`,`to`) | SM, FM |
| `GET` | `/api/v1/sites/{siteId}/usage-logs` | UsageLog rows | SM, FM |
| `GET` | `/api/v1/sites/{siteId}/alerts` | Open anomalies for site equipment | SM, FM |
| `GET` | `/api/v1/sites/{siteId}/telemetry/latest` | Latest reading per machine on site | SM, FM |

### 5.5 Operators (lightweight)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/operators` | List operators (company) | FM, SM |
| `POST` | `/api/v1/operators` | Create operator profile (if modeled) | FM |
| `GET` | `/api/v1/operators/{operatorId}/assignments` | What they have checked out | FM, SM |

**Site Manager dashboard widgets → APIs**

| Widget | API |
|--------|-----|
| My sites | `GET /sites` |
| On-site machines | `GET /sites/{id}/equipment` |
| Scan QR | `POST /checkouts/scan` |
| Active checkouts | `GET /checkouts/active?siteId=` |
| Site alerts | `GET /sites/{id}/alerts` |
| Usage summary | `GET /sites/{id}/usage` |

---

## 6. Fleet Manager Dashboard APIs (primary)

**Goal (HLD + PS):** Full company view — all rented equipment, **live status**, **live logs**, anomalies, utilization, demand, optimization.

### 6.1 Fleet overview (home dashboard)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/fleet/overview` | KPI strip + status breakdown | **FM** |
| `GET` | `/api/v1/fleet/machines` | **All machines under company rentals** with live status | **FM** |
| `GET` | `/api/v1/fleet/machines/{equipmentId}` | Deep dive: contract, site, operator, last telemetry, open alerts | **FM** |
| `GET` | `/api/v1/fleet/map` | Lat/lon + liveStatus for map pins | **FM** |
| `GET` | `/api/v1/fleet/sites` | Site cards: machine count, utilization, alert count | **FM** |
| `GET` | `/api/v1/fleet/unassigned` | Rented but no site / no operator (PS misuse) | **FM** |

**`GET /api/v1/fleet/overview` response (shape)**
```json
{
  "totals": {
    "machinesRented": 48,
    "working": 22,
    "idle": 9,
    "off": 11,
    "overdue": 3,
    "withOpenAlerts": 7,
    "staleTelemetry": 2
  },
  "utilization7dPct": 61.4,
  "avgIdleRatio7d": 0.28,
  "contractsExpiring7d": 5,
  "criticalAlerts": 4
}
```

**`GET /api/v1/fleet/machines` row (shape)**
```json
{
  "equipmentId": 1,
  "equipmentName": "CAT 320",
  "equipmentType": "Excavator",
  "dealerName": "Metro CAT",
  "contractId": 10,
  "rentalStatus": "ACTIVE",
  "expectedReturn": "2026-08-05T00:00:00Z",
  "siteId": 3,
  "siteName": "North Pit",
  "operatorId": "OP101",
  "liveStatus": "WORKING",
  "lastSeenAt": "2026-07-30T17:42:01Z",
  "telemetry": {
    "engineStatus": "ON",
    "fuelLevel": 62.5,
    "engineHours": 1204.2,
    "idleHours": 152.0,
    "engineTemperature": 88.0,
    "latitude": 37.77,
    "longitude": -122.42,
    "speed": 4.2
  },
  "openAlertCount": 1,
  "highestSeverity": "WARNING"
}
```

**Filters:** `liveStatus`, `siteId`, `equipmentType`, `rentalStatus`, `hasAlert`, `unassigned`, `q`.

### 6.2 Live status & telemetry history

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/fleet/machines/{equipmentId}/telemetry/latest` | Single latest reading | FM, SM* |
| `GET` | `/api/v1/fleet/machines/{equipmentId}/telemetry` | History (`from`,`to`, downsample) | FM |
| `GET` | `/api/v1/fleet/machines/{equipmentId}/status-timeline` | Status transitions for charts | FM |
| `GET` | `/api/v1/telemetry/snapshot` | Batch latest for all (or filtered) fleet machines | FM |

\*Site Manager: only equipment on their sites.

### 6.3 Live logs (dashboard event feed)

Aggregated human-readable stream for the “Live Logs” panel (checkouts, telemetry anomalies, reminders, status changes).

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/fleet/logs` | Paginated event log (`type`, `equipmentId`, `siteId`, `from`, `to`) | **FM** |
| `GET` | `/api/v1/fleet/logs/export` | CSV export for audit | FM |

**Event types**
```
TELEMETRY_RECEIVED | STATUS_CHANGED | CHECK_OUT | CHECK_IN |
ALERT_RAISED | ALERT_RESOLVED | CONTRACT_OVERDUE | RETURN_REMINDER |
ASSIGNMENT_CREATED | DEMAND_RECOMMENDATION
```

### 6.4 Contracts (company / fleet side)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/contracts` | Company rental contracts | FM |
| `GET` | `/api/v1/contracts/{contractId}` | Detail | FM |
| `GET` | `/api/v1/contracts/expiring` | Due within N days (`days=7`) | FM |
| `GET` | `/api/v1/contracts/overdue` | OVERDUE list | FM |
| `POST` | `/api/v1/contracts/{contractId}/request-extension` | Request dealer extension (optional workflow) | FM |

### 6.5 Usage analytics (PS: total rented hours, per site, downtime)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/analytics/usage/summary` | Fleet totals: runtime, idle, fuel, downtime | FM |
| `GET` | `/api/v1/analytics/usage/by-site` | Per-site breakdown | FM |
| `GET` | `/api/v1/analytics/usage/by-equipment` | Per-machine breakdown | FM |
| `GET` | `/api/v1/analytics/usage/by-type` | Per equipment type | FM |
| `GET` | `/api/v1/analytics/utilization` | Utilization & avg utilization last 7 days (HLD inputs) | FM |
| `GET` | `/api/v1/analytics/underutilized` | Flag under-utilized assets (PS) | FM |

### 6.6 Fleet Manager dashboard → API checklist

| UI panel (priority) | Endpoint(s) |
|---------------------|-------------|
| KPI header | `GET /fleet/overview` |
| Machines table | `GET /fleet/machines` |
| Map | `GET /fleet/map` |
| Machine detail drawer | `GET /fleet/machines/{id}` + telemetry + alerts |
| Live status badges | fields on `/fleet/machines` + SSE `/live/fleet` |
| Live logs panel | `GET /fleet/logs` + SSE `/live/logs` |
| Alerts table | `GET /alerts` + SSE `/live/alerts` |
| Overdue / return soon | `GET /contracts/overdue`, `/contracts/expiring` |
| Site utilization | `GET /analytics/utilization`, `/usage/by-site` |
| Demand / pre-position | `GET /demand/forecast`, `/demand/recommendations` |
| Optimization | `GET /demand/optimize` |

---

## 7. Anomaly Detection & Alerts APIs

HLD: Extract Feature → Static Rules + Isolation Forest → Notification Service → Dashboard.

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/alerts` | List alerts (`severity`, `type`, `isResolved`, `equipmentId`, `siteId`, `from`, `to`) | FM, SM*, Dealer* |
| `GET` | `/api/v1/alerts/{alertId}` | Alert detail + recommendation | FM, SM |
| `POST` | `/api/v1/alerts/{alertId}/resolve` | Resolve with optional note | FM, SM |
| `POST` | `/api/v1/alerts/{alertId}/ack` | Acknowledge without resolve | FM, SM |
| `GET` | `/api/v1/alerts/summary` | Counts by severity / type | FM |
| `GET` | `/api/v1/fleet/machines/{equipmentId}/alerts` | Alert history for machine | FM |

**ML ops (Fleet Manager / admin — HLD anomaly box)**

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/ml/status` | Model loaded, feature cols, threshold, trained_at | FM |
| `POST` | `/api/v1/ml/predict` | Score a single feature vector (lab / debug) | FM |
| `POST` | `/api/v1/ml/train` | Retrain Isolation Forest from training CSV | FM (admin) |
| `GET` | `/api/v1/ml/features/schema` | Document rule features vs IF features | FM |

\*Site Manager: alerts for own sites only. Dealer: optional alerts that affect returned assets / abuse (if product allows).

---

## 8. Demand Forecasting & Optimization APIs

HLD blocks:

- Utilization / avg utilization (last 7d), project completion, checkout date, TimeStore  
- Project phase / requirements (Postgres)  
- **Demand Score (machine, site)**  
- Similar type machines under fleet  
- **Optimization Score** (machine, distance penalty, source site utilization, total cost)  
- Recommend Optimization  

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/demand/status` | Service health / last job run | FM |
| `GET` | `/api/v1/demand/forecast` | Demand by site × type over horizon (`days=14`) | FM |
| `GET` | `/api/v1/demand/forecast/by-site/{siteId}` | Site-focused forecast | FM |
| `GET` | `/api/v1/demand/scores` | Demand scores list `(equipmentType, siteId, score, reasons)` | FM |
| `GET` | `/api/v1/demand/recommendations` | Pre-position suggestions | FM |
| `POST` | `/api/v1/demand/optimize` | Body: `{ siteId, equipmentType?, neededBy? }` → ranked machines | FM |
| `GET` | `/api/v1/demand/optimize/{jobId}` | Async job result (if heavy) | FM |
| `GET` | `/api/v1/demand/similar/{equipmentId}` | Similar type machines under fleet (HLD) | FM |
| `GET` | `/api/v1/sites/{siteId}/project-requirements` | Project phase / required types (input to demand) | FM |
| `PUT` | `/api/v1/sites/{siteId}/project-requirements` | Upsert requirements / phase | FM |

**`POST /demand/optimize` response (shape)**
```json
{
  "siteId": 3,
  "equipmentType": "Excavator",
  "candidates": [
    {
      "equipmentId": 12,
      "sourceSiteId": 1,
      "demandScore": 0.82,
      "optimizationScore": 0.74,
      "distanceKm": 18.2,
      "sourceUtilization7d": 0.41,
      "estimatedRelocationCost": 420.0,
      "totalCostScore": 0.69,
      "reason": "Under-utilized at Site 1; high demand at North Pit next 7d"
    }
  ]
}
```

---

## 9. Notification Service APIs

HLD: Scheduler (cron 15 min + nightly) → reminders; anomaly path → Notification Service → clients.

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/notifications` | In-app inbox (`unreadOnly`) | All roles |
| `GET` | `/api/v1/notifications/unread-count` | Badge count | All |
| `POST` | `/api/v1/notifications/{id}/read` | Mark one read | All |
| `POST` | `/api/v1/notifications/read-all` | Mark all read | All |
| `GET` | `/api/v1/notifications/preferences` | Channels: in-app / email / SSE types | All |
| `PUT` | `/api/v1/notifications/preferences` | Update preferences | All |

**Notification categories**

| `category` | Trigger |
|------------|---------|
| `RETURN_REMINDER` | Scheduler: expected_return approaching |
| `OVERDUE` | Contract past due |
| `ANOMALY` | Rules / Isolation Forest alert |
| `ASSIGNMENT` | Checkout / checkin / reassignment |
| `DEMAND` | New optimization recommendation |
| `SYSTEM` | Pipeline / model issues |

**Internal (not public dashboard; for workers)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/internal/notifications/dispatch` | Worker creates + fan-out (service token) |
| `POST` | `/api/v1/internal/scheduler/reminders/run` | Cron trigger for return reminders |
| `POST` | `/api/v1/internal/scheduler/overdue/run` | Mark overdue + notify |

---

## 10. Live streaming APIs (SSE)

HLD: Fleet Manager Dashboard ← **SSE or WebSocket**.

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/live/fleet` | SSE: machine status patches (`text/event-stream`) | **FM** |
| `GET` | `/api/v1/live/logs` | SSE: live log lines | **FM** |
| `GET` | `/api/v1/live/alerts` | SSE: new/resolved alerts | FM, SM |
| `GET` | `/api/v1/live/site/{siteId}` | SSE: site-scoped status (Site Manager app) | SM, FM |

**SSE event example**
```
event: machine.updated
data: {"equipmentId":1,"liveStatus":"ALERT","lastSeenAt":"...","telemetry":{...}}

event: alert.created
data: {"alertId":99,"severity":"CRITICAL","anomalyType":"ENGINE_OVERHEAT","equipmentId":"1"}

event: log.append
data: {"id":"...","type":"CHECK_OUT","message":"EQ-1 checked out at North Pit","ts":"..."}
```

**Query params:** `siteId`, `equipmentId` (filter streams), `Last-Event-ID` for resume.

---

## 11. Pipeline / ops APIs (support HLD streaming path)

Not main dashboard UX; needed for simulation, health, and ops.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/health` | API + DB + Redis + model | Public/ops |
| `GET` | `/api/v1/health/pipeline` | MQTT subscriber / redis / last ingest age | Ops |
| `POST` | `/api/v1/simulate/telemetry` | Push one packet through ingestion (dev) | FM/admin |
| `POST` | `/api/v1/ingest/telemetry` | HTTP ingest fallback (if not only MQTT) | Service token |
| `GET` | `/api/v1/telemetry/raw` | Recent raw rows (debug) | FM/admin |

Workers (no HTTP, or internal only): MQTT subscriber, Redis consumer, anomaly worker, reminder cron.

---

## 12. Company & user admin (shared)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `GET` | `/api/v1/company` | Company profile | FM |
| `PATCH` | `/api/v1/company` | Update company | FM |
| `GET` | `/api/v1/users` | Company users | FM |
| `POST` | `/api/v1/users` | Invite user + role | FM |
| `PATCH` | `/api/v1/users/{userId}` | Change role / sites | FM |
| `DELETE` | `/api/v1/users/{userId}` | Deactivate | FM |

---

## 13. Role × endpoint matrix (summary)

| Domain | Dealer | Site Manager | Fleet Manager |
|--------|:------:|:------------:|:-------------:|
| Auth / me | ✓ | ✓ | ✓ |
| Dealer inventory & contracts write | ✓ | — | — |
| Sites CRUD | — | R (own) | **CRUD** |
| Assignments | — | ✓ | ✓ |
| QR check-in/out | — | **✓** | ✓ |
| Fleet overview / machines / map | — | limited site | **✓** |
| Live SSE fleet + logs | — | site stream | **✓** |
| Usage analytics fleet-wide | — | site | **✓** |
| Alerts | limited | site | **✓** |
| Demand & optimize | — | — | **✓** |
| Notifications inbox | ✓ | ✓ | ✓ |
| ML train/predict | — | — | ✓ |
| Simulate / pipeline ops | — | — | admin |

---

## 14. Suggested implementation phases

### Phase 1 — Fleet Manager MVP (highest value)
1. Auth + roles  
2. `GET /fleet/overview`, `/fleet/machines`, `/fleet/machines/{id}`  
3. `GET /telemetry/snapshot` + history  
4. `GET /alerts` + resolve  
5. `GET /fleet/logs` (poll)  
6. SSE `/live/fleet` + `/live/alerts`  

### Phase 2 — Site Manager
1. Sites list/summary  
2. Assignments  
3. QR `POST /checkouts/scan` + active checkouts  
4. Site equipment + site alerts  
5. SSE `/live/site/{siteId}`  

### Phase 3 — Dealer
1. Equipment inventory CRUD  
2. Contract lifecycle  
3. Usage summary for billing  
4. Dealer summary KPIs  

### Phase 4 — Demand & optimization (HLD right side)
1. Utilization analytics (7d)  
2. Project requirements  
3. Demand scores + recommendations  
4. `POST /demand/optimize`  

### Phase 5 — Hardening
1. Scheduler reminders + overdue  
2. Notification preferences  
3. Export / audit logs  
4. RBAC tests + tenancy isolation  

---

## 15. Mapping to existing Backend (gap list)

| Exists today (approx.) | Design target |
|------------------------|---------------|
| `GET /health` | Keep → `/api/v1/health` |
| `GET /api/alerts`, resolve | Expand filters + summary + SSE |
| `GET /api/telemetry` | Become `/fleet/machines` + snapshot |
| `POST /api/simulate` | Keep as simulate + real ingest path |
| `POST /api/ml/*` | Keep under `/api/v1/ml/*` |
| `GET /api/demand/status` | Expand full demand/optimize set |
| — | Auth, dealers, sites, assignments, checkout, fleet overview, SSE, notifications, analytics |

---

## 16. Complete endpoint index (quick reference)

```
Auth
  POST   /api/v1/auth/login
  POST   /api/v1/auth/logout
  POST   /api/v1/auth/refresh
  GET    /api/v1/auth/me

Dealer
  GET    /api/v1/dealers/me
  PATCH  /api/v1/dealers/me
  GET    /api/v1/dealers/me/summary
  GET    /api/v1/dealers/equipment
  POST   /api/v1/dealers/equipment
  GET    /api/v1/dealers/equipment/{equipmentId}
  PATCH  /api/v1/dealers/equipment/{equipmentId}
  DELETE /api/v1/dealers/equipment/{equipmentId}
  POST   /api/v1/dealers/equipment/{equipmentId}/qr
  GET    /api/v1/dealers/equipment/{equipmentId}/availability
  GET    /api/v1/dealers/contracts
  POST   /api/v1/dealers/contracts
  GET    /api/v1/dealers/contracts/{contractId}
  PATCH  /api/v1/dealers/contracts/{contractId}
  POST   /api/v1/dealers/contracts/{contractId}/activate
  POST   /api/v1/dealers/contracts/{contractId}/complete
  POST   /api/v1/dealers/contracts/{contractId}/mark-overdue
  GET    /api/v1/dealers/contracts/{contractId}/usage-summary
  GET    /api/v1/dealers/companies
  GET    /api/v1/dealers/companies/{companyId}
  GET    /api/v1/dealers/notifications
  POST   /api/v1/dealers/notifications/{id}/read

Sites & assignments (Site Manager + Fleet Manager)
  GET    /api/v1/sites
  POST   /api/v1/sites
  GET    /api/v1/sites/{siteId}
  PATCH  /api/v1/sites/{siteId}
  GET    /api/v1/sites/{siteId}/summary
  GET    /api/v1/sites/{siteId}/equipment
  GET    /api/v1/sites/{siteId}/usage
  GET    /api/v1/sites/{siteId}/usage-logs
  GET    /api/v1/sites/{siteId}/alerts
  GET    /api/v1/sites/{siteId}/telemetry/latest
  GET    /api/v1/sites/{siteId}/project-requirements
  PUT    /api/v1/sites/{siteId}/project-requirements
  GET    /api/v1/assignments
  POST   /api/v1/assignments
  GET    /api/v1/assignments/{assignmentId}
  PATCH  /api/v1/assignments/{assignmentId}
  POST   /api/v1/assignments/{assignmentId}/return-to-yard

Check-in / Check-out (QR)
  POST   /api/v1/checkouts/scan
  POST   /api/v1/checkouts
  POST   /api/v1/checkins
  GET    /api/v1/checkouts/active
  GET    /api/v1/equipment/by-qr/{qrCode}
  GET    /api/v1/equipment/by-rfid/{rfidTag}

Operators
  GET    /api/v1/operators
  POST   /api/v1/operators
  GET    /api/v1/operators/{operatorId}/assignments

Fleet Manager (core dashboard)
  GET    /api/v1/fleet/overview
  GET    /api/v1/fleet/machines
  GET    /api/v1/fleet/machines/{equipmentId}
  GET    /api/v1/fleet/machines/{equipmentId}/telemetry/latest
  GET    /api/v1/fleet/machines/{equipmentId}/telemetry
  GET    /api/v1/fleet/machines/{equipmentId}/status-timeline
  GET    /api/v1/fleet/machines/{equipmentId}/alerts
  GET    /api/v1/fleet/map
  GET    /api/v1/fleet/sites
  GET    /api/v1/fleet/unassigned
  GET    /api/v1/fleet/logs
  GET    /api/v1/fleet/logs/export
  GET    /api/v1/telemetry/snapshot

Contracts (company)
  GET    /api/v1/contracts
  GET    /api/v1/contracts/{contractId}
  GET    /api/v1/contracts/expiring
  GET    /api/v1/contracts/overdue
  POST   /api/v1/contracts/{contractId}/request-extension

Analytics
  GET    /api/v1/analytics/usage/summary
  GET    /api/v1/analytics/usage/by-site
  GET    /api/v1/analytics/usage/by-equipment
  GET    /api/v1/analytics/usage/by-type
  GET    /api/v1/analytics/utilization
  GET    /api/v1/analytics/underutilized

Alerts & ML
  GET    /api/v1/alerts
  GET    /api/v1/alerts/{alertId}
  POST   /api/v1/alerts/{alertId}/resolve
  POST   /api/v1/alerts/{alertId}/ack
  GET    /api/v1/alerts/summary
  GET    /api/v1/ml/status
  POST   /api/v1/ml/predict
  POST   /api/v1/ml/train
  GET    /api/v1/ml/features/schema

Demand & optimization
  GET    /api/v1/demand/status
  GET    /api/v1/demand/forecast
  GET    /api/v1/demand/forecast/by-site/{siteId}
  GET    /api/v1/demand/scores
  GET    /api/v1/demand/recommendations
  POST   /api/v1/demand/optimize
  GET    /api/v1/demand/optimize/{jobId}
  GET    /api/v1/demand/similar/{equipmentId}

Notifications
  GET    /api/v1/notifications
  GET    /api/v1/notifications/unread-count
  POST   /api/v1/notifications/{id}/read
  POST   /api/v1/notifications/read-all
  GET    /api/v1/notifications/preferences
  PUT    /api/v1/notifications/preferences

Live (SSE)
  GET    /api/v1/live/fleet
  GET    /api/v1/live/logs
  GET    /api/v1/live/alerts
  GET    /api/v1/live/site/{siteId}

Company / users
  GET    /api/v1/company
  PATCH  /api/v1/company
  GET    /api/v1/users
  POST   /api/v1/users
  PATCH  /api/v1/users/{userId}
  DELETE /api/v1/users/{userId}

Health / ops
  GET    /api/v1/health
  GET    /api/v1/health/pipeline
  POST   /api/v1/simulate/telemetry
  POST   /api/v1/ingest/telemetry
  GET    /api/v1/telemetry/raw
  POST   /api/v1/internal/notifications/dispatch
  POST   /api/v1/internal/scheduler/reminders/run
  POST   /api/v1/internal/scheduler/overdue/run
```

---

## 17. Design decisions (explicit)

1. **Fleet Manager is the hub** — richest read APIs + all SSE channels.  
2. **Dealer owns inventory & contract creation**; company Fleet Manager consumes rentals, does not create dealer stock.  
3. **Site Manager owns operational check-in/out** via QR → Assignment Service.  
4. **Live status is derived**, not a single DB column — computed from telemetry + contract + alerts.  
5. **SSE first** for live dashboard (HLD); WebSocket optional later.  
6. **Demand/optimize is Fleet Manager only** — strategic pre-positioning, not site-local QR flow.  
7. **Pipeline stays async** (MQTT/Redis/workers); dashboard only reads Postgres + SSE fan-out from publish events.

---

*Document status: API design plan for implementation. Next step: OpenAPI skeleton or Phase 1 Fleet Manager route stubs in FastAPI.*
