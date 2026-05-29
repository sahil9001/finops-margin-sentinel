# Deploying a Coral-Powered App to Railway

A practical guide based on real deployment experience. Covers every gotcha so you don't have to find them yourself.

---

## What is Coral?

Coral is a CLI tool that gives you a single SQL interface over APIs like GitHub, Slack, Stripe, and more. Your app calls `coral sql "SELECT ..."` via subprocess, and Coral handles auth, pagination, and API calls behind the scenes.

Because Coral is a **binary** (not a pip package), standard PaaS platforms like Streamlit Community Cloud won't work — you need a platform that supports Docker.

**Railway** is the recommended choice: Docker support, simple env var management, and auto-deploys from GitHub.

---

## Project Structure

```
your-project/
├── app.py
├── requirements.txt
├── Dockerfile
├── start.sh
├── config.toml
└── .gitignore
```

---

## Step 1 — requirements.txt

Only include Python packages. Coral is a binary and does NOT go here.

```
streamlit>=1.35.0
groq>=0.9.0
python-dotenv>=1.0.0
```

> **Gotcha:** Don't auto-generate this with `pip freeze` from a mixed environment — it will miss packages that were installed differently (like `groq`) and include hundreds of irrelevant ones.

---

## Step 2 — Find the Right Coral Binary

Coral ships separate binaries per platform. For Railway (Linux x86_64), you need:

```
coral-x86_64-unknown-linux-gnu.tar.gz
```

Get the latest release URL from: https://github.com/withcoral/coral/releases

> **Gotcha:** Your local `coral.exe` (Windows) will not run on Railway's Linux containers. Never copy the Windows binary into your repo expecting it to work.

---

## Step 3 — Dockerfile

Download Coral at build time — don't commit the binary to your repo (it's 50MB+).

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install curl and tar for downloading Coral
RUN apt-get update && apt-get install -y curl tar && rm -rf /var/lib/apt/lists/*

# Download and install Coral binary
RUN curl -L https://github.com/withcoral/coral/releases/download/v0.4.1/coral-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz && mv coral /usr/local/bin/coral && chmod +x /usr/local/bin/coral

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY . .
RUN chmod +x start.sh

EXPOSE 8501
CMD ["bash", "start.sh"]
```

> **Gotcha 1:** Name the file exactly `Dockerfile` — no extension. `Dockerfile.txt` is ignored by Railway and it falls back to Nixpacks, which skips your pip install entirely.

> **Gotcha 2:** Railway may still use Nixpacks even with a Dockerfile present if an old cached build is running. Go to **Service → Settings → Build** and confirm the builder shows **Dockerfile**. Then do a manual redeploy.

> **Gotcha 3:** `RUN coral source add github` in the Dockerfile runs at **build time** when env vars aren't available yet. Use `start.sh` instead (see Step 4).

---

## Step 4 — start.sh (Critical)

Coral sources must be registered **at runtime**, not build time, because that's when your secret tokens are available via env vars.

```bash
#!/bin/bash
coral source add github
coral source add slack
streamlit run app.py --server.port=8501 --server.address=0.0.0.0
```

> **Gotcha:** Without this, Coral has no registered sources and every query returns:
> `Error: Table 'github.advisories' not found. Schema 'github' is not currently registered.`

---

## Step 5 — config.toml

This tells Coral which sources are installed and which env var names to read secrets from. Create this in your project root:

```toml
version = 1

[workspaces.default.sources.github]
variables = { GITHUB_API_BASE = "https://api.github.com" }
secrets = ["GITHUB_TOKEN"]
origin = "bundled"

[workspaces.default.sources.slack]
variables = {}
secrets = ["SLACK_TOKEN"]
origin = "bundled"
```

To find what inputs a source needs:
```bash
coral source info github
coral source info slack
```

---

## Step 6 — Get Your Tokens

**GitHub Token**
1. Go to https://github.com/settings/tokens
2. Create a new token with scopes: `repo`, `read:org`, `security_events`
3. Copy the `ghp_...` value

**Slack Token**
1. Go to https://api.slack.com/apps → open your app
2. Go to **OAuth & Permissions** → copy the **Bot Token** (`xoxb-...`)
3. Make sure your bot is invited to any channels you want to query (`/invite @yourbot`)

> **Gotcha:** Generating a new Slack token does NOT invalidate your existing local token. Both work simultaneously.

---

## Step 7 — .gitignore

```
.env
*.env
__pycache__/
*.pyc
```

Never commit tokens or `.env` files to GitHub.

---

## Step 8 — Deploy on Railway

1. Push your repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Go to **Service → Variables** and add:

```
GROQ_API_KEY     = gsk_...
GITHUB_TOKEN     = ghp_...
SLACK_TOKEN      = xoxb-...
```

5. Go to **Service → Settings → Build** — confirm builder is **Dockerfile**
6. Go to **Service → Settings → Networking** → **Generate Domain** → enter port `8501`
7. Railway auto-deploys on every GitHub push

> **Gotcha:** The domain generation dialog defaults to port `8080`. Change it to `8501` (Streamlit's port) or your app won't be reachable.

---

## Debugging Checklist

| Symptom | Likely Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'groq'` | Railway using Nixpacks instead of Dockerfile | Check builder setting; rename `Dockerfile.txt` → `Dockerfile` |
| `Schema 'github' is not currently registered` | `coral source add` not running at startup | Add `start.sh` and use it as CMD |
| `Channel Unavailable` in Slack | Wrong token or bot not in channel | Verify token in Railway vars; `/invite @bot` in channel |
| App loads but data is empty | Env vars not reaching Coral | Check Railway Variables tab; re-run manual deploy |
| Old error persists after fix | Railway running cached build | Go to Deployments → three dots → Redeploy |

---

## How Coral Resolves Credentials

When you run `coral source add github`, Coral:
1. Looks for an env var named `GITHUB_TOKEN`
2. Stores a reference to it in its local config (`secrets.env`)
3. At query time, reads the actual token from the environment

This is why `start.sh` must run at container startup — that's the only moment when Railway's env vars are injected and available for Coral to read.

Local state is stored at:
- **Windows:** `%APPDATA%\withcoral\coral\config`
- **Linux/Mac:** `~/.config/coral` or `~/.local/share/withcoral/coral/config`

You can override this with: `export CORAL_CONFIG_DIR=/path/to/config`

---

## Updating Coral Version

To upgrade, just change the version in the Dockerfile download URL:

```dockerfile
RUN curl -L https://github.com/withcoral/coral/releases/download/v0.4.2/coral-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz && mv coral /usr/local/bin/coral && chmod +x /usr/local/bin/coral
```

Push to GitHub and Railway redeploys automatically.

---

## Full File Reference

All files you need are listed above. Minimum viable deployment is:
`Dockerfile` + `start.sh` + `requirements.txt` + `config.toml` + your app + Railway env vars.
