# Security review: OWASP Top 10 (2025) coverage

Review date: 2026-11-15. Method: the `security-testing` skill from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) (installed locally, not committed), applied in five layers (secret scanning, dependency scanning, SAST, live DAST-style probes, and auth/negative-path tests), each mapped to an OWASP 2025 category. Every category below is covered by a test or check, or recorded as an accepted risk with a reason.

## Results by layer

| Layer | Tool / method | Result |
|---|---|---|
| 1. Secret scanning | Full git history (all commits) scanned for the real Supabase keys, current and previous DB passwords, PEM keys, JWTs, `sb_*` keys, AWS/GitHub tokens, real DB URLs, and committed `.env`/`.pem` files | **0 findings** |
| 2. Dependencies (SCA) | OSV database queried for every exact version in `package-lock.json` (340 packages) | **Production: 0 advisories.** Dev-only: 1 (`deepmerge-ts`, accepted, see below). Vitest upgraded 3 → 4, removing 8 dev advisories including 2 critical `tinypool` RCEs. |
| 3. SAST | Semgrep 1.182 with `p/owasp-top-ten`, `p/typescript`, `p/nodejsscan`, `p/jwt`, `p/secrets` and `p/react` (256 rules, 115 files) | 7 mutable GitHub Action tags → **fixed** (pinned to commit SHAs). 7 informational (security headers present). 2 "hardcoded password" = the intentionally public demo password (accepted, see below). |
| 4. Live probes | About 60 requests against production (`kickstead.vercel.app` and the EC2 API) | All passed. See the probe table below. |
| 5. Auth / negative paths | Vitest + Supertest suite (204 tests; `security.test.ts`, `tokenVerifier.test.ts`, `auth.test.ts`, `admin.test.ts` and ownership tests) | All passing. Added: `alg:none` token rejection; tampered-payload rejection. |

## OWASP Top 10 (2025) map

| Category | Controls | Evidence |
|---|---|---|
| **A01 Broken Access Control** | `requireAuth` on every non-public route; `requireRole('ADMIN')` on the whole `/api/admin` router; ownership checks return 404 for other users' carts, addresses and orders; roles come from the DB; CORS allow-list; Supabase RLS on all tables | `admin.test.ts` (10 admin endpoints → 401 anonymous, 403 customer, no data change); `security.test.ts` (16 customer endpoints → 401); ownership tests in `cart`, `addresses`, `orders` and `checkout` tests; live: anonymous admin/orders → 401, foreign-origin CORS → no allow header, Supabase REST with the public key → 0 rows, insert → 401 |
| **A02 Security Misconfiguration** | Helmet headers; no `X-Powered-By`; stack traces never returned; production refuses a wildcard `CLIENT_URL`; only port 80 public on EC2 | Live: TRACE → 404, `/.env` and `/.git/config` not exposed, no source maps published, malformed JSON → safe 400, ports 3000/4000/5432/6379/8080/443 closed; `gaps.test.ts` (safe 500 with request id, no internal detail) |
| **A03 Software Supply Chain** | `npm ci` from the committed lockfile in CI and Docker; actions pinned to full commit SHAs; production image excludes dev tooling (116 MB, no Prisma CLI); fork PR workflows need approval (`all_external_contributors`); default `GITHUB_TOKEN` is read-only | OSV scan (0 production advisories); Semgrep mutable-tag findings resolved; repo Actions settings checked through the GitHub API. **Gap:** no SBOM or provenance attestation yet (see recommendations). |
| **A04 Cryptographic Failures** | HTTPS with HSTS on the frontend (TLS 1.0/1.1 refused, HTTP → 308); Supabase hashes passwords (the API never sees them); asymmetric ES256 JWTs; no secrets in logs, URLs or audit metadata | Live TLS/HSTS probes; `admin.test.ts` asserts no secrets in audit output. **Accepted:** the Vercel → EC2 leg is plain HTTP (no custom domain). |
| **A05 Injection** | Prisma parameterised queries; raw SQL only as tagged templates (no `$queryRawUnsafe` in app code); strict zod schemas; LIKE wildcards escaped; React escapes output (no `dangerouslySetInnerHTML`, `eval` or `innerHTML`) | Live: SQLi / UNION / `DROP TABLE` / XSS / template payloads in `q` → 200 with 0 results; SQLi in a path parameter → 404; `security.test.ts` (literal `%` and `_`); source grep |
| **A06 Insecure Design** | Rate limits (300/min per IP; 20/min per user on checkout, payment and cancel); one unpaid order per customer; idempotency keys; 10-per-item cap; server-side pricing; no server-side fetching of user URLs (no SSRF surface) | `security.test.ts` (per-user 429 that doesn't affect other users, global 429); `checkout.test.ts` / `gaps.test.ts` (races, caps, price authority); live: negative quantity → 401 anonymous / 400 validated, page/limit abuse → 400, 150 KB body → 413 |
| **A07 Authentication Failures** | Supabase Auth (Google OAuth + email with verification required); JWKS verification with fixed issuer/audience, expiry, asymmetric algorithms only, UUID subject; disabled accounts → 403; key-server outage → 503 (not 401) | `tokenVerifier.test.ts` (expired, wrong key, wrong issuer, wrong audience, HS256, **alg:none**, **tampered payload**, garbage); `auth.test.ts`; live: a forged alg:none token is blocked by Vercel's firewall (403) and rejected by the API (401). **Accepted:** signing out revokes the refresh token, but the current access token stays valid until it expires (Supabase default 1 h). |
| **A08 Software / Data Integrity** | CSP on the frontend: `script-src 'self'` (no unsafe-inline or unsafe-eval for scripts), `frame-ancestors 'none'`, `object-src 'none'`; images signed into GHCR by commit SHA; automatic rollback on a failed health check | Live header probe. **Accepted:** `style-src` allows `'unsafe-inline'` (needed by inline React style attributes; scripts are unaffected); the Google Fonts stylesheet can't carry SRI because its CSS is generated per browser. |
| **A09 Logging & Alerting** | Audit log for every material action (actor, entity, before/after); request IDs in logs and 500 responses; access logs exclude bodies and auth headers; inventory ledger | `admin.test.ts`, `journey.test.ts` (audit attribution and ledger invariant). **Gap:** no alerting (see recommendations). |
| **A10 Exceptional Conditions** | One error contract; auth fails closed; Supabase key outage → 503 rather than letting requests through; failed first deploy stops its container; DB errors mapped to safe codes | `gaps.test.ts` (Prisma error mapping, safe 500), `security.test.ts` (413, page cap), `auth.test.ts` (503 AUTH_UNAVAILABLE) |
| **CSRF** (part of A05 in the skill) | Not applicable: the API authenticates with an `Authorization: Bearer` header, not cookies, so a cross-site request can't carry credentials | Design review |

## Accepted risks

| Risk | Why accepted | When to revisit |
|---|---|---|
| **Public demo admin account** (`admin@kickstead.dev` / `Kickstead@Demo1`, published in the README) | Required so reviewers can test the admin flows (PRD §6.1). Anyone can sign in to production as an admin and change products, stock or order statuses. Every action is audited, and the seed script restores the demo data. | **After the review period:** deactivate the account (`users.is_active = false`, or remove it from the seed), or rotate its password. |
| `deepmerge-ts` (HIGH, dev-only) | Used only by the Prisma CLI's config loader. Not in the production image; never given user input. The fix needs a breaking upgrade to Prisma 7. | When upgrading to Prisma 7 |
| Vercel → EC2 over HTTP | No custom domain. The browser → Vercel leg is HTTPS. | When a domain is added: put TLS on the instance (Caddy or Let's Encrypt) |
| Port 80 directly reachable | Vercel IPs aren't fixed. A client that skips Vercel can set its own `X-Forwarded-For` and influence the per-IP limit; the per-user limits are unaffected. | With a custom domain or CloudFront in front |
| Access token valid until expiry after sign-out | Stateless JWTs; refresh tokens are revoked by Supabase. | If immediate revocation becomes a requirement |
| Email sign-up possible through the Supabase API | Supabase can't restrict sign-up by provider. Email verification is required, and such accounts are only customers. | n/a |

## Recommendations (not yet done)

1. **SBOM and provenance (A03):** add `anchore/sbom-action` and `actions/attest-build-provenance` to the `publish` job.
2. **Alerting (A09):** forward container logs to CloudWatch Logs with alarms for 5xx spikes, `AUTH_UNAVAILABLE` and health-check failures; add an uptime check on `/api/health`.
3. **Secret scanning in CI:** add TruffleHog (`--only-verified`) as a CI step so future commits are checked automatically.
4. **DAST in CI:** run the OWASP ZAP baseline scan against production on a schedule (it was blocked from running locally during this review).
5. **Database password:** use a randomly generated, letters-and-digits-only password (the current one is derived from a value that was shared during development).
