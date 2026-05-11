export const SCENE_RND_CONFIG = {
  fog: {
    color: '#1a2540',
    density: 0.025,
  },
  background: '#0a1228',
  camera: {
    fov: 35,
    position: [0, 1.5, 12] as [number, number, number],
    lookAt: [0, 0, -10] as [number, number, number],
  },
  lights: {
    ambient: { intensity: 0.35, color: '#b8c8e0' },
    directional: { intensity: 2.5, color: '#ffffff', position: [6, 10, 6] as [number, number, number] },
    rim: { intensity: 3.0, color: '#7aa8e0', position: [0, 4, -10] as [number, number, number], distance: 30, decay: 1.2 },
    accentWarm: { intensity: 2.5, color: '#e8b078', position: [10, 4, 0] as [number, number, number], distance: 25, decay: 1.5 },
    accentCool: { intensity: 2.0, color: '#5a7aa8', position: [-10, 3, -5] as [number, number, number], distance: 25, decay: 1.5 },
  },
  environmentModel: {
    position: [0, -4, -10] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    name: 'environment-model',
  },
  dust: {
    count: 30,
    speed: 0.20,
    opacity: 0.25,
    size: 0.8,
    scale: [14, 4, 8] as [number, number, number],
    position: [0, -2, -6] as [number, number, number],
    color: '#d8e2ee'
  },
  postFX: {
    dof: { focusDistance: 0.025, focalLength: 0.08, bokehScale: 1.5 },
    bloom: { intensity: 0.7, luminanceThreshold: 0.6 },
    vignette: { offset: 0.30, darkness: 0.55 },
    noise: { opacity: 0.020 },
  },
    environment: {
    path: "/spatial/hdri/moonlit_golf_1k.hdr",
    intensity: 0.80
  },
  panels3d: {
    kpi: { entityId: 'kpi', position: [-3.5, 1.5, -2] as [number, number, number] },
    mission: { entityId: 'mission', position: [0, 0.5, -4] as [number, number, number] },
    brief: { entityId: 'brief', position: [3.5, 1.5, -2] as [number, number, number] },
  }
}

export type SceneConfig = typeof SCENE_RND_CONFIG;
