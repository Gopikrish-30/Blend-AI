# Blender Agent RW — Installation Guide

A full-stack AI Blender assistant: **Cherry Studio** (Electron AI chat) + **blender-mcp** (MCP server) + **Blender** (3D application), all wired together so an AI model can control Blender directly via natural language.

---

## Option A — Docker (Recommended for Linux testers)

Everything runs in one container with a virtual desktop accessible from any browser. No local installs needed except Docker.

### Prerequisites

- Docker Engine ≥ 24 — https://docs.docker.com/engine/install/
- Docker Compose ≥ 2 — bundled with Docker Desktop; on Linux: `sudo apt install docker-compose-plugin`
- ~6 GB free disk space (image + layer cache)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<YOUR_REPO>.git blender-agent-rw
cd blender-agent-rw

# 2. Build and start (takes 5–15 min on first run)
docker compose up --build

# 3. Open the desktop in your browser
#    http://localhost:6080
#    Click "Connect" — no password required
```

Inside the browser desktop you will see:
- **Cherry Studio** — the AI chat interface (left)
- **Blender** — the 3D viewport (right)

The BlenderMCP addon is automatically enabled and the TCP socket is running. Cherry Studio will detect it and show **Connected** in the MCP settings.

### Verify the Integration

1. Open Cherry Studio inside the noVNC desktop
2. Navigate to **Settings → MCP Servers** — confirm "Blender MCP" is green with 64 tools
3. Start a new chat and send: `Check my Blender scene — what objects are in it?`
4. The AI should call `get_scene_info` and return scene details (not plain text)

### Adding API Keys (optional)

Pass keys via `docker-compose.yml` environment section:

```yaml
services:
  blender-agent:
    environment:
      - BLENDERMCP_SKETCHFAB_API_KEY=your_key_here
      - BLENDERMCP_HYPER3D_API_KEY=your_key_here
```

Then restart: `docker compose up`

### Persisting Data

The compose file mounts two named volumes:
- `cherry_studio_data` → Cherry Studio settings, SQLite DB, chat history
- `uv_cache` → Python package cache (faster rebuilds)

Data survives container restarts. To reset completely: `docker compose down -v`

### Useful Commands

```bash
# View logs
docker compose logs -f

# Open a shell inside the container
docker exec -it blender-agent-rw bash

# Stop everything
docker compose down

# Rebuild after code changes
docker compose up --build
```

---

## Option B — Native Linux (Ubuntu 22.04 / 24.04)

Run everything directly on your Linux machine — faster, no virtual desktop needed.

### Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Node.js | `>=24.11.1 <24.16.0` | See below |
| pnpm | `11.8.0` | `npm i -g pnpm@11.8.0` |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Python | `>=3.10` | System or `uv python install 3.12` |
| Blender | `>=3.0` | https://www.blender.org/download/ |
| Git | any | `sudo apt install git` |

### 1. Install Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt-get install -y nodejs
node --version   # must be >=24.11.1 and <24.16.0
```

### 2. Install pnpm and uv

```bash
npm install -g pnpm@11.8.0
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc   # or reload your shell
```

### 3. Clone and Set Up

```bash
git clone https://github.com/<YOUR_REPO>.git blender-agent-rw
cd blender-agent-rw
```

### 4. Install blender-mcp dependencies

```bash
cd blender-mcp
uv sync          # creates .venv with all Python dependencies
cd ..
```

### 5. Install Cherry Studio dependencies

```bash
cd cherry-studio
pnpm install
cd ..
```

### 6. Install the Blender Addon

1. Open **Blender**
2. Go to **Edit → Preferences → Add-ons → Install**
3. Navigate to `blender-agent-rw/blender-mcp/addon.py` and click **Install Add-on**
4. Enable the checkbox next to **Blender MCP**
5. In the **3D Viewport**, press **N** to open the side panel → click the **BlenderMCP** tab
6. Enable the integrations you want (PolyHaven, Sketchfab, etc.)
7. The server starts automatically — you should see **Connected** in the panel

### 7. Run Cherry Studio

```bash
cd cherry-studio
pnpm dev
```

Cherry Studio opens. On first launch, the seeder runs automatically:
- Configures "Blender MCP" server pointing to your local `blender-mcp/` directory
- Creates the "Blender Assistant" with the expert system prompt

### 8. Verify

1. Open **Settings → MCP Servers** — "Blender MCP" should show green with 64 tools
2. Start a new chat, select the `llama-3.3-70b-versatile` model (Groq)
3. Send: `Check my Blender scene — what objects are in it?`
4. The AI should call `get_scene_info` and describe your scene

---

## Troubleshooting

### MCP shows 0 tools or is red

The MCP server failed to start. Check:

```bash
# Test the MCP server manually
cd blender-agent-rw/blender-mcp
uv run blender-mcp
# Should print: "BlenderMCP is an MCP server and is meant to be launched by your MCP client..."
# Press Ctrl-C to exit
```

If `uv run blender-mcp` errors:
```bash
uv sync        # re-create the virtual environment
uv run blender-mcp
```

### MCP shows 22 tools instead of 64

Cherry Studio is using the **PyPI version** instead of the local one. This means `BLENDER_MCP_DIR` is not set or the path is wrong.

Fix: Set the env var before launching Cherry Studio:
```bash
export BLENDER_MCP_DIR="/absolute/path/to/blender-agent-rw/blender-mcp"
cd cherry-studio && pnpm dev
```

Or verify the path Cherry Studio resolved by checking the MCP server's command in **Settings → MCP Servers → Blender MCP → Edit**.

### AI responds with plain text instead of calling tools

The model does not have `function-call` capability registered. Run this check:

```bash
# Find the Cherry Studio data directory
# Linux native: ~/.config/CherryStudio/data/data.sqlite
# Docker:       in the cherry_studio_data volume (/root/.config/CherryStudio/...)

sqlite3 ~/.config/CherryStudio/data/data.sqlite \
  "SELECT model_id, capabilities FROM user_model WHERE model_id LIKE '%llama%70b%'"
```

The `capabilities` column must contain `["function-call"]`. If it's empty, re-add the model in Cherry Studio Settings → Models.

### Blender MCP socket not connecting

1. Make sure Blender is open (not running headless with `-b`)
2. The BlenderMCP addon must be enabled — check **Edit → Preferences → Add-ons**
3. The TCP server starts automatically; verify in the **N panel → BlenderMCP tab** — status should say "Running"
4. Default port is `9876` — make sure nothing else is using it:
   ```bash
   ss -tlnp | grep 9876
   ```

### Docker: noVNC blank screen

Xvfb or Openbox failed to start. Check logs:
```bash
docker compose logs blender-agent | head -50
```

Look for `ERROR: Xvfb failed to start` and ensure your host has `libx11` available for the container.

### Docker: `pnpm install` fails with lockfile error

The `pnpm-lock.yaml` must be present in the build context. Verify it was not accidentally added to `.dockerignore`:
```bash
grep pnpm-lock .dockerignore   # should return nothing
```

---

## Repository Structure

```
blender-agent-rw/
├── blender-mcp/              # Python MCP server + Blender addon
│   ├── addon.py              # Blender addon (install this into Blender)
│   ├── src/blender_mcp/
│   │   └── server.py         # FastMCP server — 64 tools
│   └── pyproject.toml
├── cherry-studio/            # Electron AI chat application
│   └── src/
│       ├── main/             # Electron main process
│       └── renderer/         # React UI
├── Dockerfile                # Full-stack container (Blender + Cherry Studio)
├── docker-compose.yml        # Compose with named volumes
├── entrypoint.sh             # Container startup sequence
├── enable_addon.py           # Blender Python startup script
├── INSTALL.md                # This file
└── DOCKER.md                 # Docker-specific docs
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BLENDER_MCP_DIR` | auto-detected | Absolute path to the `blender-mcp/` directory |
| `BLENDER_HOST` | `localhost` | Host where Blender's TCP socket is running |
| `BLENDER_PORT` | `9876` | Port of Blender's TCP socket |
| `ELECTRON_DISABLE_SANDBOX` | unset | Set to `1` in Docker (required for Chromium in container) |
| `DISPLAY` | unset | Set to `:99` in Docker (Xvfb virtual display) |
| `BLENDERMCP_SKETCHFAB_API_KEY` | unset | Sketchfab API key |
| `BLENDERMCP_HYPER3D_API_KEY` | unset | Hyper3D Rodin API key |
