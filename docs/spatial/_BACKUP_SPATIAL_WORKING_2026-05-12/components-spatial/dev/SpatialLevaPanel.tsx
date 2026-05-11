"use client";

import { useEffect } from "react";
import { Leva, useControls, button, folder } from "leva";
import { useSpatialSceneStore } from "@/stores/spatial-scene";

export function SpatialLevaPanel() {
  // On récupère le state initial pour Leva (sans s'abonner aux changements pour éviter les boucles)
  const initialState = useSpatialSceneStore.getState();

  const [controls, set] = useControls(() => ({
    "Export config": button(() => {
      const current = useSpatialSceneStore.getState();
      const code = `export const SCENE_RND_CONFIG = {
  fog: {
    color: '${current.fog.color}',
    density: ${current.fog.density.toFixed(4)},
  },
  background: '${current.background}',
  camera: {
    fov: ${current.camera.fov},
    position: [${current.camera.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
    lookAt: [${current.camera.lookAt.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
  },
  lights: {
    ambient: { intensity: ${current.lights.ambient.intensity.toFixed(2)}, color: '${current.lights.ambient.color}' },
    directional: { intensity: ${current.lights.directional.intensity.toFixed(2)}, color: '${current.lights.directional.color}', position: [${current.lights.directional.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number] },
    rim: { intensity: ${current.lights.rim.intensity.toFixed(2)}, color: '${current.lights.rim.color}', position: [${current.lights.rim.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number], distance: ${current.lights.rim.distance}, decay: ${current.lights.rim.decay} },
    accentWarm: { intensity: ${current.lights.accentWarm.intensity.toFixed(2)}, color: '${current.lights.accentWarm.color}', position: [${current.lights.accentWarm.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number], distance: ${current.lights.accentWarm.distance}, decay: ${current.lights.accentWarm.decay} },
    accentCool: { intensity: ${current.lights.accentCool.intensity.toFixed(2)}, color: '${current.lights.accentCool.color}', position: [${current.lights.accentCool.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number], distance: ${current.lights.accentCool.distance}, decay: ${current.lights.accentCool.decay} },
  },
  environmentModel: {
    position: [${current.environmentModel.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
    scale: [${current.environmentModel.scale.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
    rotation: [${current.environmentModel.rotation.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
    name: '${current.environmentModel.name}',
  },
  dust: {
    count: ${current.dust.count},
    speed: ${current.dust.speed.toFixed(2)},
    opacity: ${current.dust.opacity.toFixed(2)},
    size: ${current.dust.size.toFixed(2)},
    scale: [${current.dust.scale.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
    position: [${current.dust.position.map(n=>n.toFixed(2)).join(', ')}] as [number, number, number],
    color: '${current.dust.color}'
  },
  postFX: {
    dof: { focusDistance: ${current.postFX.dof.focusDistance.toFixed(4)}, focalLength: ${current.postFX.dof.focalLength.toFixed(4)}, bokehScale: ${current.postFX.dof.bokehScale.toFixed(2)} },
    bloom: { intensity: ${current.postFX.bloom.intensity.toFixed(2)}, luminanceThreshold: ${current.postFX.bloom.luminanceThreshold.toFixed(2)} },
    vignette: { offset: ${current.postFX.vignette.offset.toFixed(2)}, darkness: ${current.postFX.vignette.darkness.toFixed(2)} },
    noise: { opacity: ${current.postFX.noise.opacity.toFixed(3)} },
  },
  environment: {
    path: "${current.environment.path}",
    intensity: ${current.environment.intensity.toFixed(2)}
  }
} as const;`;
      navigator.clipboard.writeText(code);
      alert("Config copiée dans le presse-papier !");
    }),
    "Reset to config": button(() => {
      useSpatialSceneStore.getState().reset();
      // On force le re-render des levas en rechargeant la page
      window.location.reload();
    }),
    "Fog & Background": folder({
      fogColor: { value: initialState.fog.color },
      fogDensity: { value: initialState.fog.density, min: 0, max: 0.1, step: 0.001 },
      bgColor: { value: initialState.background },
    }),
    "Caméra": folder({
      fov: { value: initialState.camera.fov, min: 10, max: 100 },
    }),
    "Lumières": folder({
      ambientIntensity: { value: initialState.lights.ambient.intensity, min: 0, max: 1 },
      ambientColor: { value: initialState.lights.ambient.color },
      dirIntensity: { value: initialState.lights.directional.intensity, min: 0, max: 3 },
      dirColor: { value: initialState.lights.directional.color },
      dirPosX: { value: initialState.lights.directional.position[0], step: 0.1 },
      dirPosY: { value: initialState.lights.directional.position[1], step: 0.1 },
      dirPosZ: { value: initialState.lights.directional.position[2], step: 0.1 },
      rimIntensity: { value: initialState.lights.rim.intensity, min: 0, max: 3 },
      rimColor: { value: initialState.lights.rim.color },
      rimPosX: { value: initialState.lights.rim.position[0], step: 0.1 },
      rimPosY: { value: initialState.lights.rim.position[1], step: 0.1 },
      rimPosZ: { value: initialState.lights.rim.position[2], step: 0.1 },
      rimDistance: { value: initialState.lights.rim.distance, min: 0, max: 50 },
      rimDecay: { value: initialState.lights.rim.decay, min: 0, max: 3 },
      accentWarmIntensity: { value: initialState.lights.accentWarm.intensity, min: 0, max: 3 },
      accentWarmColor: { value: initialState.lights.accentWarm.color },
      accentWarmPosX: { value: initialState.lights.accentWarm.position[0], step: 0.1 },
      accentWarmPosY: { value: initialState.lights.accentWarm.position[1], step: 0.1 },
      accentWarmPosZ: { value: initialState.lights.accentWarm.position[2], step: 0.1 },
      accentWarmDistance: { value: initialState.lights.accentWarm.distance, min: 0, max: 50 },
      accentWarmDecay: { value: initialState.lights.accentWarm.decay, min: 0, max: 3 },
      accentCoolIntensity: { value: initialState.lights.accentCool.intensity, min: 0, max: 3 },
      accentCoolColor: { value: initialState.lights.accentCool.color },
      accentCoolPosX: { value: initialState.lights.accentCool.position[0], step: 0.1 },
      accentCoolPosY: { value: initialState.lights.accentCool.position[1], step: 0.1 },
      accentCoolPosZ: { value: initialState.lights.accentCool.position[2], step: 0.1 },
      accentCoolDistance: { value: initialState.lights.accentCool.distance, min: 0, max: 50 },
      accentCoolDecay: { value: initialState.lights.accentCool.decay, min: 0, max: 3 },
    }),
    "Environment Model": folder({
      envModelPosX: { value: initialState.environmentModel.position[0], step: 0.1 },
      envModelPosY: { value: initialState.environmentModel.position[1], step: 0.1 },
      envModelPosZ: { value: initialState.environmentModel.position[2], step: 0.1 },
      envModelScale: { value: initialState.environmentModel.scale[0], min: 0.1, max: 10, step: 0.1 },
      envModelRotY: { value: initialState.environmentModel.rotation[1], step: 0.01 },
    }),
    "Dust": folder({
      dustCount: { value: initialState.dust.count, min: 0, max: 200, step: 1 },
      dustSpeed: { value: initialState.dust.speed, min: 0, max: 1 },
      dustOpacity: { value: initialState.dust.opacity, min: 0, max: 1 },
      dustSize: { value: initialState.dust.size, min: 0, max: 10 },
      dustColor: { value: initialState.dust.color },
      dustPosX: { value: initialState.dust.position[0], step: 0.5 },
      dustPosY: { value: initialState.dust.position[1], step: 0.5 },
      dustPosZ: { value: initialState.dust.position[2], step: 0.5 },
      dustScaleX: { value: initialState.dust.scale[0], step: 1 },
      dustScaleY: { value: initialState.dust.scale[1], step: 1 },
      dustScaleZ: { value: initialState.dust.scale[2], step: 1 },
    }),
    "Post-FX": folder({
      dofFocusDist: { value: initialState.postFX.dof.focusDistance, min: 0, max: 0.1, step: 0.001 },
      dofFocalLength: { value: initialState.postFX.dof.focalLength, min: 0, max: 0.5, step: 0.001 },
      dofBokehScale: { value: initialState.postFX.dof.bokehScale, min: 0, max: 10 },
      bloomIntensity: { value: initialState.postFX.bloom.intensity, min: 0, max: 2 },
      bloomThreshold: { value: initialState.postFX.bloom.luminanceThreshold, min: 0, max: 1 },
      vignetteOffset: { value: initialState.postFX.vignette.offset, min: 0, max: 1 },
      vignetteDarkness: { value: initialState.postFX.vignette.darkness, min: 0, max: 1 },
      noiseOpacity: { value: initialState.postFX.noise.opacity, min: 0, max: 0.2, step: 0.001 },
    }),
    "HDRI": folder({
      envIntensity: { value: initialState.environment.intensity, min: 0, max: 2 },
    })
  }));

  // Sync Leva -> Store
  useEffect(() => {
    const store = useSpatialSceneStore.getState();
    
    store.setFog({ color: controls.fogColor, density: controls.fogDensity });
    store.setBackground(controls.bgColor);
    store.setCamera({ fov: controls.fov });
    store.setLight("ambient", { intensity: controls.ambientIntensity, color: controls.ambientColor });
    store.setLight("directional", { intensity: controls.dirIntensity, color: controls.dirColor, position: [controls.dirPosX, controls.dirPosY, controls.dirPosZ] });
    store.setLight("rim", { intensity: controls.rimIntensity, color: controls.rimColor, position: [controls.rimPosX, controls.rimPosY, controls.rimPosZ], distance: controls.rimDistance, decay: controls.rimDecay });
    store.setLight("accentWarm", { intensity: controls.accentWarmIntensity, color: controls.accentWarmColor, position: [controls.accentWarmPosX, controls.accentWarmPosY, controls.accentWarmPosZ], distance: controls.accentWarmDistance, decay: controls.accentWarmDecay });
    store.setLight("accentCool", { intensity: controls.accentCoolIntensity, color: controls.accentCoolColor, position: [controls.accentCoolPosX, controls.accentCoolPosY, controls.accentCoolPosZ], distance: controls.accentCoolDistance, decay: controls.accentCoolDecay });
    
    store.setEnvironmentModel({ 
      position: [controls.envModelPosX, controls.envModelPosY, controls.envModelPosZ], 
      scale: [controls.envModelScale, controls.envModelScale, controls.envModelScale], 
      rotation: [0, controls.envModelRotY, 0] 
    });

    store.setDust({ count: controls.dustCount, speed: controls.dustSpeed, opacity: controls.dustOpacity, size: controls.dustSize, color: controls.dustColor, position: [controls.dustPosX, controls.dustPosY, controls.dustPosZ], scale: [controls.dustScaleX, controls.dustScaleY, controls.dustScaleZ] });
    
    store.setPostFX({
      dof: { focusDistance: controls.dofFocusDist, focalLength: controls.dofFocalLength, bokehScale: controls.dofBokehScale },
      bloom: { intensity: controls.bloomIntensity, luminanceThreshold: controls.bloomThreshold },
      vignette: { offset: controls.vignetteOffset, darkness: controls.vignetteDarkness },
      noise: { opacity: controls.noiseOpacity }
    });

    store.setEnvironment({ intensity: controls.envIntensity });
  }, [controls]);

  return (
    <div className="relative z-[9999]">
      <Leva collapsed={false} titleBar={{ title: "Spatial R&D Config" }} />
    </div>
  );
}
