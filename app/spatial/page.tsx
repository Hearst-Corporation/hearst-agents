import { SpatialLayout } from '@/components/spatial/core/SpatialLayout';
import { SpatialScene } from '@/components/spatial/core/SpatialScene';
import { SpatialLogoCore } from '@/components/spatial/core/SpatialLogoCore';
import { SpatialOverlayManager } from '@/components/spatial/overlays/SpatialOverlayManager';
import '@/styles/spatial/spatial.css';

export default function SpatialPage() {
  return (
    <SpatialLayout>
      <SpatialScene>
        <SpatialLogoCore />
      </SpatialScene>
      <SpatialOverlayManager />
    </SpatialLayout>
  );
}
