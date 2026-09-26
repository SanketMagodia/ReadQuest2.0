import { ShelfLoadingStage } from "@/components/ui/ShelfLoadingStage";

/** Shown while a page in the main shell is still arriving. Same shelf as the in-page loaders, so the lone gif never flashes first. */
export default function MainLoading() {
  return (
    <ShelfLoadingStage
      className="min-h-[min(70vh,720px)]"
      lines={["The shelf is turning", "One moment"]}
      hint="Loading…"
    />
  );
}
