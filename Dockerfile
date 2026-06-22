FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── System base ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    curl git build-essential unzip ca-certificates \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# ── Blender + virtual desktop stack ──────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    blender \
    xvfb x11vnc openbox novnc websockify \
    libgtk-3-0 libnss3 libasound2 libxss1 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 \
    libdrm2 libgbm1 libxkbcommon0 libxrender1 \
    libxtst6 libxi6 libgl1 libglu1-mesa \
    dbus-x11 net-tools iproute2 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html

# ── Node.js — exact version required by cherry-studio (>=24.11.1 <24.16.0) ──
# Pin to 24.11.1 to stay within the declared range.
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y "nodejs=24.*" \
    && node --version \
    && rm -rf /var/lib/apt/lists/*

# ── pnpm — exact version from package.json#packageManager ────────────────────
RUN npm install -g pnpm@11.8.0

# ── uv (Python package manager) ──────────────────────────────────────────────
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# ── Workspace ─────────────────────────────────────────────────────────────────
WORKDIR /app
COPY . .

# ── Blender addon auto-load ───────────────────────────────────────────────────
ENV BLENDER_USER_SCRIPTS=/app/blender_scripts
RUN mkdir -p ${BLENDER_USER_SCRIPTS}/addons \
    && cp /app/blender-mcp/addon.py ${BLENDER_USER_SCRIPTS}/addons/addon.py

# ── blender-mcp Python env (creates .venv so uv run --directory works) ───────
RUN cd /app/blender-mcp && uv sync

# ── cherry-studio Node dependencies ──────────────────────────────────────────
RUN cd /app/cherry-studio && pnpm install --frozen-lockfile

RUN chmod +x /app/entrypoint.sh

# ── Ports ─────────────────────────────────────────────────────────────────────
# 6080 → noVNC web browser access
# 5900 → raw VNC socket
# 9876 → Blender MCP TCP socket
EXPOSE 6080 5900 9876

# ── Runtime environment ───────────────────────────────────────────────────────
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_SANDBOX=1
ENV BLENDER_HOST=localhost
ENV BLENDER_PORT=9876
# Tells blenderMcpSeeder where the local blender-mcp package lives
ENV BLENDER_MCP_DIR=/app/blender-mcp

ENTRYPOINT ["/app/entrypoint.sh"]
