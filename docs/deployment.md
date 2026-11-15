# Deployment

```text
Browser ──HTTPS──▶ Vercel (React build; rewrites /api/* →) ──HTTP──▶ EC2 t3.micro :80 → Docker kickstead-api :4000 ──▶ Supabase Postgres (pooler)
   └──────────────────────── Supabase Auth (Google OAuth, email/password demo) ───────────────────────┘
```

- **Frontend:** Vercel, built from `frontend/`. It serves the single-page app and forwards `/api/*` to the EC2 host, so the browser only ever talks to one HTTPS origin.
- **Backend:** a Docker image built by GitHub Actions and pushed to GHCR (`ghcr.io/<owner>/kickstead-api:<git-sha>`). The EC2 host pulls it and runs it with `--restart unless-stopped`.
- **Database:** Supabase Postgres. GitHub Actions applies migrations before each deploy.

Pipeline (`.github/workflows/ci-cd.yml`):
1. **`test`** (every push and pull request, GitHub-hosted): typecheck, run the full test suite against a throwaway Postgres 16 service container, and build.
2. **`publish`** (push to `main`, GitHub-hosted): run `prisma migrate deploy` against Supabase, then build and push the linux/amd64 image to GHCR.
3. **`deploy`** (push to `main`): runs **on the EC2 instance** through a self-hosted GitHub Actions runner. It pulls the image, swaps the container and waits for `/api/health`. If the new container never becomes healthy, it rolls back to the previous one automatically.

The runner makes an **outgoing** connection to GitHub, so the instance needs **no inbound SSH from the internet**. Port 22 stays limited to the admin's IP.

---

## 1. EC2 host (one-time)

- **Instance:** Ubuntu 24.04, t3.micro, region `ap-south-1` (same region as Supabase), with an Elastic IP.
- **Server setup:** Docker (`docker.io`), the `ubuntu` user in the `docker` group, 2 GB swap, and an `/opt/kickstead` folder.
- **Security group:**

| Port | Source | Purpose |
|---|---|---|
| 22 | **Your IP only** | Admin SSH. Deploys don't need it. |
| 80 | `0.0.0.0/0` | API, reached through the Vercel rewrite |

### Self-hosted runner (one-time)

1. **GitHub → repo → Settings → Actions → Runners → New self-hosted runner →** choose Linux, x64. GitHub shows download commands and a short-lived registration **token**.
2. On the instance, as `ubuntu`, run GitHub's *Download* commands, then configure:
   ```bash
   cd ~/actions-runner
   ./config.sh --url https://github.com/<owner>/<repo> --token <TOKEN> \
     --name kickstead-ec2 --labels kickstead-ec2 --unattended
   sudo ./svc.sh install ubuntu     # run as a service, starting on boot, as the ubuntu user (in the docker group)
   sudo ./svc.sh start
   sudo ./svc.sh status             # should report active (running)
   ```
3. Under **Settings → Actions → Runners**, the runner should show as **Idle** with the labels `self-hosted`, `linux`, `x64`, `kickstead-ec2`.

> **Public repository safety.** A self-hosted runner executes workflow code, and a pull request from a fork could edit the workflow to target it. Go to **Settings → Actions → General → "Approval for running fork pull request workflows from contributors"** and choose **"Require approval for all external contributors"**. The `deploy` job itself only runs on pushes to `main`.

### Production settings on the server

Create `/opt/kickstead/.env` on the server (it's never committed, and the pipeline never sends it):

```bash
nano /opt/kickstead/.env && chmod 600 /opt/kickstead/.env
```

```dotenv
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
SUPABASE_URL=https://<ref>.supabase.co
ADMIN_EMAILS=you@example.com,admin@kickstead.dev
CLIENT_URL=https://<your-vercel-domain>
```

> **Don't put quotes around values.** `docker --env-file` keeps quote characters as part of the value, which breaks the connection string. URL-encode special characters in the password (`@` → `%40`).

## 2. GitHub secrets

Add these under **Repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler URL (port 6543, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Supabase session pooler URL (port 5432), used by migrations |

That's all. No SSH key or server address is stored in GitHub. `GITHUB_TOKEN` is provided automatically: the workflow uses it to push the image to GHCR and to pull it on the instance, and it expires when the job ends.

## 3. Vercel (frontend)

1. **Add New → Project →** import the GitHub repo.
2. **Root Directory:** `frontend`. Framework is detected as Vite; `frontend/vercel.json` sets the build and rewrites.
3. **Environment variables** (Production): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, the same values as `frontend/.env`.
4. **Deploy.** Note the URL, e.g. `https://kickstead.vercel.app`.
5. If the EC2 IP changes, update the `/api/:path*` destination in `frontend/vercel.json`.

`vercel.json` also sets security headers: a CSP limited to the origins the app uses (Google Fonts, `https:` images, `*.supabase.co`), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. Built assets are cached for one year.

## 4. Point the auth providers at production

Once the Vercel URL is known:

| Where | Setting |
|---|---|
| Supabase → Authentication → URL Configuration | **Site URL** = `https://<vercel-domain>`. Add `https://<vercel-domain>/**` to **Redirect URLs** (keep the localhost entry for development). |
| Google Cloud → OAuth client | Add `https://<vercel-domain>` to **Authorized JavaScript origins**. The redirect URI stays the Supabase callback. |
| EC2 `/opt/kickstead/.env` | `CLIENT_URL=https://<vercel-domain>`, then restart: `docker restart kickstead-api` |

## 5. Deploy

Push to `main`, or run the workflow manually (**Actions → CI/CD → Run workflow**). Watch the run; the deploy job's last step checks `/api/health` on the instance. From your machine, check `curl http://<EC2_HOST>/api/health`.

## Operating the server

```bash
docker ps                                  # running container and its health status
docker logs -f --tail 100 kickstead-api    # follow the logs (each request has an X-Request-Id)
docker restart kickstead-api               # after editing /opt/kickstead/.env
curl -s localhost/api/health               # {"status":"ok","database":"up"}
```

**Manual rollback:** every image is tagged with its commit SHA.

```bash
docker rm -f kickstead-api
docker run -d --name kickstead-api --restart unless-stopped --env-file /opt/kickstead/.env \
  -p 80:4000 --memory 600m --log-opt max-size=10m --log-opt max-file=3 \
  ghcr.io/<owner>/kickstead-api:<previous-sha>
```

## Known limitations

- Traffic between Vercel and EC2 is plain HTTP, because there's no custom domain. The browser-to-Vercel leg is HTTPS. Adding a domain with Caddy or Let's Encrypt on the instance would encrypt the second leg too.
- Single instance: rate limits are kept in memory, and a deploy has a few seconds of downtime while the container is swapped.
- The runner service uses roughly 100–150 MB of RAM on the t3.micro; the 2 GB swap gives headroom. The runner user is in the `docker` group, which is effectively root on the instance, so keep the fork-approval setting on.
- Port 80 is reachable directly, so a client that skips Vercel can send its own `X-Forwarded-For` header and influence the per-IP rate limit. The per-user limits on checkout and payment are unaffected.
