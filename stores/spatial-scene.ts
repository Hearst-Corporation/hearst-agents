import { create } from 'zustand';
import { SCENE_RND_CONFIG, SceneConfig } from '@/lib/spatial/scene-config';

interface SpatialSceneState extends SceneConfig {
  setFog: (fog: Partial<SceneConfig['fog']>) => void;
  setBackground: (background: string) => void;
  setCamera: (camera: Partial<SceneConfig['camera']>) => void;
  setLight: (light: keyof SceneConfig['lights'], data: Partial<SceneConfig['lights'][keyof SceneConfig['lights']]>) => void;
  setEnvironmentModel: (data: Partial<SceneConfig['environmentModel']>) => void;
  setDust: (dust: Partial<SceneConfig['dust']>) => void;
  setPostFX: (postFX: Partial<SceneConfig['postFX']>) => void;
  setEnvironment: (env: Partial<SceneConfig['environment']>) => void;
  reset: () => void;
}

export const useSpatialSceneStore = create<SpatialSceneState>((set) => ({
  ...SCENE_RND_CONFIG,

  setFog: (fog) => set((state) => ({ fog: { ...state.fog, ...fog } })),
  setBackground: (background) => set({ background }),
  setCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),
  setLight: (light, data) => set((state) => ({
    lights: {
      ...state.lights,
      [light]: { ...state.lights[light], ...data }
    }
  })),
  setEnvironmentModel: (data) => set((state) => ({
    environmentModel: { ...state.environmentModel, ...data }
  })),
  setDust: (dust) => set((state) => ({ dust: { ...state.dust, ...dust } })),
  setPostFX: (postFX) => set((state) => ({ postFX: { ...state.postFX, ...postFX } })),
  setEnvironment: (env) => set((state) => ({ environment: { ...state.environment, ...env } })),
  
  reset: () => set(SCENE_RND_CONFIG)
}));
