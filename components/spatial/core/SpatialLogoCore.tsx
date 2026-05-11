'use client';

import dynamic from 'next/dynamic';
import type { Application } from '@splinetool/runtime';
import { SpatialLogoInteraction } from './SpatialLogoInteraction';

const SPLINE_SCENE = 'https://prod.spline.design/jc1CUanFKE-XIpec/scene.splinecode';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-spatial-sm animate-pulse">
      Loading Spatial Core...
    </div>
  ),
});

export interface SpatialLogoCoreProps {
  /** Capture l'`Application` Spline dès qu'elle est instanciée client-side.
   *  Branchée par `SpatialRoot` au hook `useSplineApp`. */
  onLoad?: (app: Application) => void;
}

/**
 * Noyau Spline — client only.
 * Chargé dynamiquement (ssr:false) car Spline fait un fetch top-level
 * vers prod.spline.design qui pète en SSR sur Next 16 RSC.
 * Clic sur le robot = toggle Look At.
 */
export function SpatialLogoCore({ onLoad }: SpatialLogoCoreProps) {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div className="absolute inset-0 w-full h-full translate-x-[15%] md:translate-x-[20%]">
        <SpatialLogoInteraction>
          <Spline scene={SPLINE_SCENE} className="w-full h-full" onLoad={onLoad} />
        </SpatialLogoInteraction>
      </div>
    </div>
  );
}
