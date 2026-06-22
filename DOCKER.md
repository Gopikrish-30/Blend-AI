# Blender Agent & CherryStudio Docker Guide

This guide explains how to package, run, and test the complete workspace (`blender-mcp` + `cherry-studio`) inside a Linux container using Docker.

The container runs a headless Linux desktop with:
- **Blender** (installed and running with the BlenderMCP addon enabled)
- **CherryStudio** (Electron application running in development mode)
- **noVNC + websockify** (allows you to view and interact with the Linux desktop directly in your web browser)

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

---

## Getting Started

### 1. Build and Run the Container

Build and start the container in the background:
```bash
docker-compose up --build
```

This will:
1. Compile and install Linux-compatible native node modules.
2. Spin up Xvfb (Virtual Framebuffer) on Display `:99`.
3. Launch openbox (window manager) and TigerVNC.
4. Set up websockify/noVNC on port `6080`.
5. Launch Blender with the BlenderMCP socket server listening on port `9876`.
6. Start CherryStudio's vite dev server and open the Electron app inside the virtual display.

---

### 2. Access the Linux Desktop

Open your web browser and navigate to:
```
http://localhost:6080/
```

You will see the **noVNC** interface. Click **Connect** to see the Linux desktop containing:
- **CherryStudio** (running on the left side)
- **Blender** (running on the right side)

You can interact with both applications normally using your mouse and keyboard!

---

### 3. Verification

Once connected, verify the integration:
1. In CherryStudio, open the **Blender Assistant** chat or the Blender tab.
2. Confirm the connection status indicator says **Connected** (which means CherryStudio successfully bound to Blender's socket on port `9876`).
3. Send a command like:
   - `Create a red metallic sphere above a wood plane.`
4. Watch Blender execute the commands in real-time on the right side of the screen.
5. Ask Blender to take a screenshot and check if CherryStudio displays the viewport render.

---

## Running Tests

To run the automated tests inside the running Docker container:

```bash
# Run CherryStudio linters and tests
docker exec -it blender-agent pnpm -C /app/cherry-studio ci

# Run specific unit tests
docker exec -it blender-agent pnpm -C /app/cherry-studio test:main
docker exec -it blender-agent pnpm -C /app/cherry-studio test:renderer
```

---

## Environment Variables & Credentials

If you have API keys (e.g. for Sketchfab or Hyper3D Rodin), you can pass them into the container using the environment or specify them directly in Blender's Preferences inside the VNC GUI:

```yaml
# In docker-compose.yml:
services:
  blender-agent:
    environment:
      - BLENDERMCP_SKETCHFAB_API_KEY=your_key_here
      - BLENDERMCP_HYPER3D_API_KEY=your_key_here
```
