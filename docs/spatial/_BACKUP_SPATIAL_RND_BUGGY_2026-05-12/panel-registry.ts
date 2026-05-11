import * as THREE from 'three';

export const panelRegistry = new Map<string, THREE.Vector3>();

if (typeof window !== 'undefined') {
  (window as any).__spatialPanelRegistry__ = panelRegistry;
}
