import { Code, Package, Wand2 } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'

export const BLENDER_ASSET_TOOL_NAMES = new Set([
  'download_polyhaven_asset',
  'download_sketchfab_model',
  'generate_hyper3d_model_via_text',
  'generate_hyper3d_model_via_images',
  'generate_hunyuan3d_model',
  'import_generated_asset',
  'import_generated_asset_hunyuan',
  'set_texture',
  'execute_blender_code'
])

export function isBlenderAssetTool(toolName: string): boolean {
  return BLENDER_ASSET_TOOL_NAMES.has(toolName)
}

// ── PolyHaven ──────────────────────────────────────────────────────────────────

const PolyHavenPreview: FC<{ input: Record<string, unknown> }> = ({ input }) => {
  const assetId = String(input.asset_id ?? '')
  const resolution = String(input.resolution ?? '1k')
  const assetType = String(input.asset_type ?? 'textures')
  const thumbnailUrl = `https://cdn.polyhaven.com/asset_img/thumbs/${assetId}.png?height=200`

  return (
    <div className="flex gap-3 p-3 pb-2">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        <img
          src={thumbnailUrl}
          alt={assetId}
          className="h-full w-full object-cover"
          onError={(e) => {
            const el = (e.target as HTMLImageElement).parentElement
            if (el) el.innerHTML = '<div class="flex h-full w-full items-center justify-center text-muted-foreground text-xs">No preview</div>'
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          PolyHaven
        </span>
        <div className="mt-1 truncate font-medium text-sm capitalize">{assetId.replace(/_/g, ' ')}</div>
        <div className="mt-0.5 text-xs text-muted-foreground capitalize">
          {assetType} · {resolution.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

// ── Sketchfab ──────────────────────────────────────────────────────────────────

const SketchfabPreview: FC<{ input: Record<string, unknown> }> = ({ input }) => {
  const uid = String(input.uid ?? '')
  const targetSize = input.target_size != null ? `${input.target_size}m` : null
  const [info, setInfo] = useState<{ name: string; thumbnail: string | null } | null>(null)

  useEffect(() => {
    if (!uid) return
    fetch(`https://api.sketchfab.com/v3/models/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        const images = data?.thumbnails?.images as Array<{ url: string; width: number }> | undefined
        const img = images?.sort((a, b) => a.width - b.width).find((i) => i.width >= 200)
        setInfo({ name: data?.name ?? uid, thumbnail: img?.url ?? null })
      })
      .catch(() => setInfo({ name: uid, thumbnail: null }))
  }, [uid])

  return (
    <div className="flex gap-3 p-3 pb-2">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {info?.thumbnail ? (
          <img src={info.thumbnail} alt={info.name} className="h-full w-full object-cover" />
        ) : (
          <Package size={24} className="text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          Sketchfab
        </span>
        <div className="mt-1 truncate font-medium text-sm">{info?.name ?? uid}</div>
        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{uid}</div>
        {targetSize && <div className="mt-0.5 text-xs text-muted-foreground">Size: {targetSize}</div>}
      </div>
    </div>
  )
}

// ── Hyper3D / Hunyuan text generation ─────────────────────────────────────────

const GenerationTextPreview: FC<{ input: Record<string, unknown>; toolName: string }> = ({ input, toolName }) => {
  // generate_hyper3d_model_via_text uses `text_prompt`
  // generate_hunyuan3d_model uses `text_prompt` and optional `input_image_url`
  const prompt = String(input.text_prompt ?? '')
  const imageUrl = input.input_image_url ? String(input.input_image_url) : null
  const isHunyuan = toolName === 'generate_hunyuan3d_model'
  const label = isHunyuan ? 'Hunyuan3D' : 'Hyper3D Rodin'
  const labelClass = isHunyuan
    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'

  return (
    <div className="flex gap-3 p-3 pb-2">
      {imageUrl ? (
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img src={imageUrl} alt="reference" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
          <Wand2 size={28} className="text-indigo-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${labelClass}`}>{label}</span>
          <span className="text-xs text-muted-foreground">AI 3D Generation</span>
        </div>
        {prompt && <div className="mt-1 line-clamp-3 text-sm text-foreground/80 italic">"{prompt}"</div>}
      </div>
    </div>
  )
}

// ── Hyper3D image-based generation ────────────────────────────────────────────

const GenerationImagesPreview: FC<{ input: Record<string, unknown> }> = ({ input }) => {
  // generate_hyper3d_model_via_images uses `input_image_paths` OR `input_image_urls`
  const paths = (input.input_image_paths as string[] | undefined) ?? []
  const urls = (input.input_image_urls as string[] | undefined) ?? []
  const sources = [...paths, ...urls]
  const count = sources.length

  return (
    <div className="flex gap-3 p-3 pb-2">
      <div className="flex gap-1">
        {count > 0 ? (
          sources.slice(0, 3).map((src, i) => (
            <div key={i} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              <img src={src} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Wand2 size={24} className="text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            Hyper3D Rodin
          </span>
          <span className="text-xs text-muted-foreground">AI 3D from Images</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {count} reference image{count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

// ── Import generated asset (Hyper3D) ──────────────────────────────────────────

const ImportAssetPreview: FC<{ input: Record<string, unknown>; toolName: string }> = ({ input, toolName }) => {
  const name = String(input.name ?? '')
  const isHunyuan = toolName === 'import_generated_asset_hunyuan'
  const label = isHunyuan ? 'Hunyuan3D' : 'Hyper3D Rodin'
  const labelClass = isHunyuan
    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
  const jobRef = String(input.task_uuid ?? input.request_id ?? input.zip_file_url ?? '')

  return (
    <div className="flex gap-3 p-3 pb-2">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
        <Package size={24} className="text-green-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${labelClass}`}>{label}</span>
          <span className="text-xs text-muted-foreground">Import to Scene</span>
        </div>
        {name && <div className="mt-1 font-medium text-sm">Object name: {name}</div>}
        {jobRef && <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{jobRef}</div>}
      </div>
    </div>
  )
}

// ── Set texture ────────────────────────────────────────────────────────────────

const SetTexturePreview: FC<{ input: Record<string, unknown> }> = ({ input }) => {
  const objectName = String(input.object_name ?? '')
  const textureId = String(input.texture_id ?? '')
  const thumbnailUrl = textureId
    ? `https://cdn.polyhaven.com/asset_img/thumbs/${textureId}.png?height=200`
    : null

  return (
    <div className="flex gap-3 p-3 pb-2">
      {thumbnailUrl ? (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img
            src={thumbnailUrl}
            alt={textureId}
            className="h-full w-full object-cover"
            onError={(e) => {
              const el = (e.target as HTMLImageElement).parentElement
              if (el) el.innerHTML = '<div class="flex h-full w-full items-center justify-center text-muted-foreground text-xs">No preview</div>'
            }}
          />
        </div>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
          <Package size={20} className="text-orange-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          Apply Texture
        </span>
        <div className="mt-1 text-xs text-muted-foreground">
          Texture: <span className="font-medium text-foreground capitalize">{textureId.replace(/_/g, ' ') || '—'}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Object: <span className="font-medium text-foreground">{objectName || '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Execute Blender code ───────────────────────────────────────────────────────

const ExecuteCodePreview: FC<{ input: Record<string, unknown> }> = ({ input }) => {
  const code = String(input.code ?? '')
  const lines = code.split('\n')
  const preview = lines.slice(0, 6).join('\n')
  const truncated = lines.length > 6

  return (
    <div className="p-3 pb-2">
      <div className="mb-2 flex items-center gap-1.5">
        <Code size={13} className="text-yellow-600" />
        <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
          Python · Blender
        </span>
        <span className="text-xs text-muted-foreground">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
      </div>
      <pre className="max-h-32 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-xs leading-relaxed text-foreground/90">
        {preview}
        {truncated && <span className="text-muted-foreground">{'\n'}… {lines.length - 6} more lines</span>}
      </pre>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export const BlenderAssetPreview: FC<{ toolName: string; input: Record<string, unknown> }> = ({
  toolName,
  input
}) => {
  if (toolName === 'download_polyhaven_asset') return <PolyHavenPreview input={input} />
  if (toolName === 'download_sketchfab_model') return <SketchfabPreview input={input} />
  if (toolName === 'generate_hyper3d_model_via_text' || toolName === 'generate_hunyuan3d_model')
    return <GenerationTextPreview input={input} toolName={toolName} />
  if (toolName === 'generate_hyper3d_model_via_images') return <GenerationImagesPreview input={input} />
  if (toolName === 'import_generated_asset' || toolName === 'import_generated_asset_hunyuan')
    return <ImportAssetPreview input={input} toolName={toolName} />
  if (toolName === 'set_texture') return <SetTexturePreview input={input} />
  if (toolName === 'execute_blender_code') return <ExecuteCodePreview input={input} />
  return null
}
