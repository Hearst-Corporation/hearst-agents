import { SpatialLayout } from "@/components/spatial/core/SpatialLayout";
import { SpatialRndRoot } from "./SpatialRndRoot";
import "@/styles/spatial/spatial.css";

export const dynamic = "force-dynamic";

export default function SpatialRndPage() {
  return (
    <SpatialLayout>
      <SpatialRndRoot />
    </SpatialLayout>
  );
}
