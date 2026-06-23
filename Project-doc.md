# Blend AI — Project Documentation

## About
Blend AI is an AI agent embedded inside a customised **Cherry Studio** desktop app that controls **Blender 3D** through natural language. You describe what you want ("build a living room with a sofa and studio lighting") and the agent plans, imports assets, places objects, sets materials, and renders — all without you touching Blender.

---

## Problem
Blender is powerful but has a steep scripting curve. Creating scenes programmatically requires Python (`bpy`) knowledge, manual asset hunting, and careful spatial calculations. There was no way to simply *describe* a scene and have it built automatically.

---

## Solution
A three-layer AI pipeline:

1. **Chat UI** — user types natural language in Cherry Studio
2. **AI Agent** — LLM (Groq / Gemini / GitHub Models) with 64+ Blender tools, plans before acting, asks questions when unsure
3. **Blender** — controlled live via a local TCP+MCP bridge

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Cherry Studio (Electron)       │
│                                         │
│  Chat UI  ──►  AI Agent (LLM)           │
│                    │                    │
│              MCP Tool Calls             │
│                    │                    │
│            MCP Client (Node.js)         │
└─────────────────────┬───────────────────┘
                      │ stdio / SSE
┌─────────────────────▼───────────────────┐
│       blender-mcp  (Python / FastMCP)    │
│   Translates MCP calls → TCP commands   │
└─────────────────────┬───────────────────┘
                      │ TCP  localhost:9876
┌─────────────────────▼───────────────────┐
│     Blender Addon  (addon.py)            │
│   TCP server inside Blender process     │
│   Executes bpy commands on main thread  │
└─────────────────────────────────────────┘
```

**Data flow:** User prompt → LLM → tool call JSON → MCP server → TCP command → Blender addon → `bpy` API → result back up the chain → rendered to chat

---

## Key Components

| Component | Tech | Role |
|-----------|------|------|
| Cherry Studio | Electron + React | Chat UI, AI orchestration, MCP client |
| blender-mcp server | Python + FastMCP | MCP ↔ TCP translation layer |
| Blender addon | Python + bpy | Executes commands inside Blender |
| Tool registry | TypeScript | 64 tools registered, scoped to Blender assistant |
| Plan Card UI | React | Interactive Accept/Edit/Reject before execution |

---

## Features & Capabilities

**Scene Control**
- Create/transform/delete objects, collections, cameras, lights
- Execute arbitrary Blender Python (`execute_blender_code`)
- Validate scene, check placement, get statistics, screenshot viewport

**Spatial Intelligence**
- Reads full scene context before acting (`get_full_scene_context`)
- Calculates real-world dimensions and collision-free placements
- Snaps objects to ground, measures distances, suggests positions

**Asset Pipeline**
- **PolyHaven** — free HDRIs, textures, 3D models (furniture, architecture)
- **Sketchfab** — branded objects, vehicles, characters (cc-by license)
- **Hyper3D / Hunyuan3D** — AI-generated 3D from text prompt
- Fallback chain: PolyHaven → Sketchfab → AI-generate → scripted primitive

**Materials & Lighting**
- Create/assign Principled BSDF materials, set HDRI world lighting
- Lighting presets: studio, interior, outdoor, night scene

**Interactive Planning UI**
- `present_plan` tool → shows a card with phases, Accept / Edit / Reject buttons before any complex task runs
- `ask_clarifying_question` tool → question card with suggestion chips + free-text input; never interrupts as plain chat text

**Multi-Model Support**
- Groq `llama-3.3-70b-versatile` (default, fast function calling)
- Gemini, GitHub Models, any OpenAI-compatible provider
- Robust arg coercion: handles models that stringify arrays or pass null for optional params

---

## Example Workflows

**Simple** — *"Add a red sphere at the origin"*
```
get_full_scene_context → create_primitive(sphere) → create_material(red) → get_viewport_screenshot
```

**Complex** — *"Build a modern living room"*
```
get_full_scene_context
→ present_plan([Phase 1: Room, Phase 2: Furniture, Phase 3: Lighting, Phase 4: Verify])
→ [User clicks Accept]
→ execute_blender_code(room geometry)
→ search_polyhaven_assets(sofa) → download → snap_to_ground → position
→ search_polyhaven_assets(coffee table) → download → suggest_placement → position
→ set_world_hdri(studio interior) → create_light(area, warm)
→ validate_scene → check_object_placement → get_viewport_screenshot
```

**Clarification** — *"Add some lighting"*
```
ask_clarifying_question("What mood?", options=["Studio","Natural","Night"])
→ [User selects "Studio"]
→ set_world_hdri(studio_small) → create_light(area, 5000K) → screenshot
```

---

## Limitations

| Limitation | Detail |
|------------|--------|
| Blender must be running | Addon requires a live Blender GUI instance (no headless `-b` mode) |
| Local only | TCP socket on `localhost:9876` — no remote Blender support |
| Model quality varies | Weaker models may mis-format tool args; coercion handles most cases |
| Asset availability | PolyHaven/Sketchfab searches depend on external APIs being reachable |
| AI-generated models | Hyper3D/Hunyuan3D jobs take 30–90 seconds and require API keys |
| No undo awareness | Agent doesn't track Blender's undo stack; errors require manual recovery |
| Single Blender instance | Only one Blender connection supported per session |
