#!/bin/bash
# Blender Agent RW — container entrypoint
# Does NOT use set -e: Blender and Electron emit non-fatal warnings that must
# not abort the container startup sequence.

echo "=========================================="
echo " Blender Agent RW — Container Starting    "
echo "=========================================="

# ── 1. Clean stale X11 locks from a previous container run ───────────────────
echo "[1/7] Cleaning stale X11 locks..."
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

# ── 2. Virtual framebuffer ────────────────────────────────────────────────────
echo "[2/7] Starting Xvfb on :99 (1280×800×24)..."
Xvfb :99 -ac -screen 0 1280x800x24 -listen tcp &
XVFB_PID=$!
sleep 2

if ! kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "ERROR: Xvfb failed to start. Aborting."
    exit 1
fi

export DISPLAY=:99

# ── 3. Window manager ─────────────────────────────────────────────────────────
echo "[3/7] Starting Openbox..."
openbox-session &
OPENBOX_PID=$!
sleep 1

# ── 4. VNC server ─────────────────────────────────────────────────────────────
echo "[4/7] Starting x11vnc on port 5900..."
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -listen 0.0.0.0 \
       -noxrecord -noxfixes -noxdamage -quiet &
VNC_PID=$!
sleep 1

# ── 5. noVNC web proxy ────────────────────────────────────────────────────────
echo "[5/7] Starting noVNC on port 6080..."
websockify --web=/usr/share/novnc 6080 localhost:5900 &
WEBSOCKIFY_PID=$!
sleep 1

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  Open http://localhost:6080 in browser  │"
echo "  │  to access the Linux desktop via noVNC  │"
echo "  └─────────────────────────────────────────┘"
echo ""

# ── 6. Blender ────────────────────────────────────────────────────────────────
echo "[6/7] Launching Blender with BlenderMCP addon..."
blender --python /app/enable_addon.py 2>&1 | sed 's/^/[Blender] /' &
BLENDER_PID=$!

# Wait up to 30 s for Blender to open port 9876
echo "Waiting for Blender MCP socket on port 9876..."
WAITED=0
while [ $WAITED -lt 30 ]; do
    if python3 -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('localhost',9876)); s.close()" 2>/dev/null; then
        echo "Blender MCP socket is ready!"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ $WAITED -ge 30 ]; then
    echo "WARNING: Blender MCP socket did not open within 30 s."
    echo "Cherry Studio will still start — you can connect Blender manually."
fi

# ── 7. Cherry Studio ──────────────────────────────────────────────────────────
echo "[7/7] Starting Cherry Studio (pnpm dev)..."
cd /app/cherry-studio
pnpm dev

# ── Cleanup when Cherry Studio exits ─────────────────────────────────────────
echo "Cherry Studio exited. Stopping all services..."
kill "$BLENDER_PID" "$WEBSOCKIFY_PID" "$VNC_PID" "$OPENBOX_PID" "$XVFB_PID" 2>/dev/null || true
echo "Container stopped."
