# Blend-AI — Installation Guide (Linux)

AI-powered Blender assistant. Cherry Studio (Electron chat UI) talks to a local MCP server that controls Blender directly via Python. You type natural language, the AI calls Blender tools.

---

## Option A — Docker (Recommended)

Everything runs inside one container. You get a full Linux desktop in your browser — no local Blender, Node.js, or Python required on the host.

### Requirements

- Docker Engine ≥ 24
- Docker Compose ≥ 2
- ~6 GB free disk space
- A modern browser (Chrome / Firefox)

Install Docker if you don't have it:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker            # apply group change without logout
```

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Gopikrish-30/Blend-AI.git
cd Blend-AI

# 2. Build the Docker image (first run takes 10–20 min — downloads Blender, Node, etc.)
docker compose up --build

# 3. Open your browser and go to:
#    http://localhost:6080
#    Click "Connect" — no password needed
```

Inside the browser desktop you will see Blender and Cherry Studio running side by side.

### Verify it works

1. In Cherry Studio, go to **Settings → MCP Servers**
2. "Blender MCP" should be **green** with **64 tools**
3. Open a new chat, pick any AI model, and type:

   > Check my Blender scene — what objects are in it?

4. The AI should call `get_scene_info` and describe the scene (not plain text)

### Useful commands

```bash
# View live logs
docker compose logs -f

# Stop everything
docker compose down

# Full reset (deletes saved chat history too)
docker compose down -v

# Rebuild after you edit source files
docker compose up --build

# Open a shell inside the running container
docker exec -it blend-ai bash
```

### Add API keys (optional)

Edit `docker-compose.yml` and add keys under `environment`:

```yaml
services:
  blender-agent:
    environment:
      - BLENDERMCP_SKETCHFAB_API_KEY=your_key_here
      - BLENDERMCP_HYPER3D_API_KEY=your_key_here
```

Then restart: `docker compose up`

---

## Option B — Native Linux Setup

Run everything directly on your machine. Faster than Docker once set up.

**Tested on:** Ubuntu 22.04 / 24.04

### Step 1 — Install system dependencies

```bash
sudo apt-get update
sudo apt-get install -y git curl build-essential python3 python3-pip python3-venv
```

### Step 2 — Install Node.js 24

Cherry Studio requires Node.js `>=24.11.1 <24.16.0`.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt-get install -y nodejs
node --version    # confirm output is 24.x.x
```

### Step 3 — Install pnpm 11.8.0

```bash
npm install -g pnpm@11.8.0
pnpm --version    # confirm 11.8.0
```

### Step 4 — Install uv (Python package manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc        # or: source ~/.zshrc  — reload PATH
uv --version            # confirm it's installed
```

### Step 5 — Clone the repository

```bash
git clone https://github.com/Gopikrish-30/Blend-AI.git
cd Blend-AI
```

### Step 6 — Set up the MCP server (blender-mcp)

```bash
cd blender-mcp
uv sync               # creates .venv with all Python dependencies
cd ..
```

Test it works:

```bash
cd blender-mcp
uv run blender-mcp
# Expected output:
#   BlenderMCP is an MCP server and is meant to be launched by your MCP client...
# Press Ctrl-C to exit
cd ..
```

### Step 7 — Install Cherry Studio dependencies

```bash
cd cherry-studio
pnpm install          # installs all Node dependencies (~2–4 min)
cd ..
```

### Step 8 — Install Blender

Download from https://www.blender.org/download/ or via apt (if your distro has a recent version):

```bash
sudo apt-get install -y blender
blender --version     # confirm 3.0 or higher
```

### Step 9 — Install the Blender addon

1. Open Blender
2. Go to **Edit → Preferences → Add-ons**
3. Click **Install** (top right)
4. Navigate to `Blend-AI/blender-mcp/addon.py` and click **Install Add-on**
5. Enable the checkbox next to **BlenderMCP**
6. In the **3D Viewport**, press **N** to open the sidebar → click the **BlenderMCP** tab
7. The status should show **Running on port 9876**

### Step 10 — Start Cherry Studio

Open a new terminal:

```bash
cd Blend-AI/cherry-studio
pnpm dev
```

Cherry Studio will open. On the first launch the seeder runs automatically and:
- Creates the **Blender MCP** server entry pointing to your local `blender-mcp/` directory
- Creates the **Blender Assistant** with the expert system prompt

### Step 11 — Add an AI model

Cherry Studio needs an AI provider with tool-calling support.

**Groq (free, fast — recommended for testing):**

1. Get a free API key at https://console.groq.com
2. In Cherry Studio: **Settings → Model Providers → Groq** → paste your key → Save
3. Add the model `llama-3.3-70b-versatile` — make sure **Function Call** is checked

**Other providers:** OpenAI, Anthropic, Google, etc. all work — just add their API key in Settings.

### Step 12 — Verify the full stack

1. Blender is open with the BlenderMCP addon enabled (Step 9)
2. Cherry Studio is running (Step 10)
3. Go to **Settings → MCP Servers** → "Blender MCP" should be **green with 64 tools**
4. Start a new chat, select the Blender Assistant, and send:

   > What objects are in my Blender scene?

5. The AI should call `get_scene_info` and return scene details

---

## Troubleshooting

### MCP server shows 22 tools instead of 64

The seeder is pointing to the PyPI version instead of your local code. Fix:

```bash
export BLENDER_MCP_DIR="$(pwd)/blender-mcp"
cd cherry-studio && pnpm dev
```

Or check what path Cherry Studio resolved: **Settings → MCP Servers → Blender MCP → Edit** — the `--directory` argument should point to your local `Blend-AI/blender-mcp` folder.

### MCP server is red / 0 tools

The MCP process failed to start. Test it manually:

```bash
cd Blend-AI/blender-mcp
uv run blender-mcp
```

If that errors, re-run `uv sync` first.

### AI replies with plain text instead of calling tools

The model doesn't have Function Call capability registered. In Cherry Studio: **Settings → Models** → find the model → make sure **Function Call** is ticked.

### Blender MCP socket not connecting

- Blender must be open (not running headless with `-b`)
- The BlenderMCP addon must be enabled — check **Edit → Preferences → Add-ons**
- Port 9876 must be free:
  ```bash
  ss -tlnp | grep 9876    # should show no output if free
  ```

### `pnpm install` fails with "frozen lockfile" error

The `pnpm-lock.yaml` file must be present. If it's missing:

```bash
cd cherry-studio
pnpm install --no-frozen-lockfile
```

### Docker: blank screen in browser

Xvfb failed to start. Check logs:

```bash
docker compose logs blender-agent | head -60
```

Look for `ERROR: Xvfb failed to start`.

---

## Repository Structure

```
Blend-AI/
├── blender-mcp/                  # Python MCP server + Blender addon
│   ├── addon.py                  # Install this file into Blender
│   ├── src/blender_mcp/
│   │   └── server.py             # FastMCP server — 64 tools
│   └── pyproject.toml
├── cherry-studio/                # Electron AI chat application (modified)
│   └── src/
│       ├── main/data/db/seeding/ # Blender Assistant + MCP seeder
│       └── shared/data/presets/  # blenderAssistant.ts — system prompt
├── Dockerfile                    # Full container: Blender + Cherry Studio
├── docker-compose.yml
├── entrypoint.sh                 # Container startup sequence
├── enable_addon.py               # Blender auto-enable script (used in Docker)
└── INSTALL.md                    # This file
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BLENDER_MCP_DIR` | auto-detected | Absolute path to the `blender-mcp/` directory |
| `BLENDER_HOST` | `localhost` | Host where Blender's TCP socket is running |
| `BLENDER_PORT` | `9876` | Port of Blender's TCP socket |
| `BLENDERMCP_SKETCHFAB_API_KEY` | unset | Sketchfab asset downloads |
| `BLENDERMCP_HYPER3D_API_KEY` | unset | Hyper3D Rodin 3D generation |
