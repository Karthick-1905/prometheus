# ADR-0001: Platform contract and migration freeze

- Status: Accepted
- Date: 2026-07-31
- Baseline: `5ea57ef`
- Integration branch: `opt`

## Telemetry identity and time

Every accepted event uses `TelemetryEnvelope` from
`Backend/app/contracts/platform.py`. `eventId` is immutable and globally unique.
`externalEquipmentId` is matched byte-for-byte after schema validation; services
must never strip digits, infer an internal ID, or fall back to equipment 1.
Unknown identifiers are quarantined. `equipmentId` is the resolved internal key.
All stored timestamps are timezone-aware UTC. `observedAt` is device time and
`receivedAt` is server ingress time.

Committed telemetry, its durable outbox record, and derived work are one database
transaction. Duplicate `eventId` returns the original outcome. Storage failure is
an error and cannot produce `success: true`.

## Assignment lifecycle and concurrency

The canonical states are `RESERVED`, `CHECKED_OUT`, `CHECKED_IN`, and `CANCELLED`.
Legal transitions are `RESERVED -> CHECKED_OUT|CANCELLED` and
`CHECKED_OUT -> CHECKED_IN`. Check-in returns equipment from a site; completing a
rental is a separate contract transition that sets `actual_return` and equipment
availability atomically.

Mutations require an idempotency key and request hash. Reusing a key with another
payload is `IDEMPOTENCY_KEY_REUSED`. Mutable resources expose an integer version;
stale versions return `VERSION_CONFLICT`. PostgreSQL constraints permit only one
`RESERVED` or `CHECKED_OUT` assignment per contract/equipment.

## Authoritative time measures

- Rental duration: elapsed UTC wall time from `rental_start` until
  `actual_return`, or the requested reporting instant for an active contract.
- Runtime: non-negative server-derived increase in the cumulative engine meter.
- Idle time: non-negative server-derived increase in the cumulative idle meter,
  bounded by the same observation interval.
- Downtime: overlap with explicit maintenance or fault-unavailable state
  intervals. Missing telemetry is not downtime.
- Unavailable time: overlap with any state that prevents rental, including
  rental, reservation, maintenance, and fault downtime.

Absent or insufficient source data is `unknown`, never numeric zero.

## Authentication and authorization

Access tokens are short lived and contain `iss`, `aud`, `sub`, `typ=access`,
`jti`, `sid`, `iat`, `nbf`, `exp`, `role`, and the server-derived tenant claims
`company_id`, `dealer_id`, and `site_ids`. Clients never choose role or tenant.
Refresh sessions are opaque, rotated, hashed at rest, revocable, and reuse
detectable. Production rejects demo login and header impersonation.

All business queries are scoped by the principal before lookup. Fleet managers
are company scoped; site roles require both company and allowed site; dealers are
dealer scoped; devices are bound to an equipment and tenant credential. Health
liveness is public. Readiness may reveal only a boolean aggregate.

## Live delivery

Durable stream IDs are replay cursors. SSE uses the names in `SSEEventName`,
includes `id`, `event`, and JSON `data`, accepts `Last-Event-ID`, and emits a
heartbeat at most every 15 seconds. Reconnect is at-least-once, so clients dedupe
by event ID. Payloads include `observedAt`, `receivedAt`, `publishedAt`, and a
freshness state: `fresh`, `stale`, or `offline`.

## Anomaly incidents

One open incident exists per tenant, equipment, anomaly family, and detector
policy version. Further matching observations append occurrences and update
severity; they do not create alerts per packet. Recovery closes the signal only
after the configured healthy window. A new incident may open after recovery and
cooldown. Each occurrence stores rule/model provenance, raw score, calibrated
severity, artifact digest/version, and telemetry event ID. Acknowledgement and
resolution actor/time/reason are immutable audit events.

## Demand persistence

`DemandRepository` is the adapter boundary. `SyntheticDemandRepository` is
explicit demo/test data and `PostgresDemandRepository` is the production source.
Production never falls back between them. Forecast runs, records, decisions,
overrides, feedback, reviews, lineage, watermarks, and idempotency outcomes are
durable and tenant scoped. Horizons remain direct weeks 1-4 with uncertainty,
alternatives, customer-first recommendations, and no automatic upselling.

## Error envelope

All new endpoints use `{ "error": { "code", "message", "details",
"correlationId", "retryable" } }`. Stable conflict codes include
`IDEMPOTENCY_KEY_REUSED`, `VERSION_CONFLICT`, `ILLEGAL_TRANSITION`,
`UNKNOWN_EQUIPMENT`, `OUT_OF_ORDER_EVENT`, `TENANT_SCOPE_VIOLATION`, and
`ARTIFACT_INCOMPATIBLE`.

## Migration allocation and frontend ownership

Alembic stays linear from `003_app_notifications`:

| Revision | Owner | Scope |
|---|---|---|
| `004_integrity_foundation` | T1 | identifiers, telemetry, assignments, usage, audit, idempotency, outbox, incidents, forecast decisions |
| `005_auth_sessions` | T5 | identities and refresh sessions |
| `006_runtime_intervals` | T6 | state intervals and lifecycle support |
| `007_demand_repository` | T8 | demand aggregates and persistence additions |

No feature thread creates another head or changes an allocated revision without
updating this ADR. Frontend API ownership is split into `auth`, `fleet`, `sites`,
`telemetry`, `notifications`, `analytics`, `alerts`, and `demand` modules;
`platform.ts` remains a compatibility re-export only.
