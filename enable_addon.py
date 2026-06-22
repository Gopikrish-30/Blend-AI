"""
Blender startup script — enables the BlenderMCP addon and starts the TCP server.
Runs via: blender --python /app/enable_addon.py

Uses bpy.app.timers to defer execution until Blender's context is fully ready.
"""
import bpy
import time


def _setup_blendermcp():
    """Deferred setup — called once Blender's main loop is running."""
    print("--- BlenderMCP Startup: enabling addon ---")

    # Enable the addon (module name = filename without .py)
    try:
        bpy.ops.preferences.addon_enable(module="addon")
        print("[OK] BlenderMCP addon enabled.")
    except Exception as e:
        print(f"[ERROR] Could not enable addon: {e}")
        return  # Don't proceed if the addon failed to load

    # Small pause to let addon registration complete
    time.sleep(0.5)

    # Enable all integration flags on the active scene
    try:
        scene = bpy.context.scene or bpy.data.scenes[0]
        scene.blendermcp_use_polyhaven  = True
        scene.blendermcp_use_sketchfab  = True
        scene.blendermcp_use_hyper3d    = True
        scene.blendermcp_use_hunyuan3d  = True
        print("[OK] All BlenderMCP integrations enabled in scene.")
    except Exception as e:
        print(f"[WARN] Could not set integration flags: {e}")

    # Ensure the TCP socket server is running
    try:
        server = getattr(bpy.types, "blendermcp_server", None)
        if server is None:
            from addon import BlenderMCPServer
            bpy.types.blendermcp_server = BlenderMCPServer(port=9876)
            server = bpy.types.blendermcp_server

        if not server.running:
            print("[..] Starting BlenderMCP socket server on port 9876...")
            server.start()
        else:
            print(f"[OK] BlenderMCP socket server already running on {server.host}:{server.port}")
    except Exception as e:
        print(f"[ERROR] Could not start BlenderMCP server: {e}")

    print("--- BlenderMCP Startup: complete ---")


# Register as a one-shot timer so it runs after Blender's event loop starts
bpy.app.timers.register(_setup_blendermcp, first_interval=1.5)
