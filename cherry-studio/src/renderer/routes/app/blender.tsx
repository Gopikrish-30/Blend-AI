import BlenderPage from '@renderer/pages/blender/BlenderPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/blender')({
  component: BlenderPage
})
