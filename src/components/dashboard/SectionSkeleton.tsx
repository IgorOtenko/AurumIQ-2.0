import type { CSSProperties } from "react";

interface SectionSkeletonProps {
  title: string;
  height?: number;
}

export default function SectionSkeleton({
  title,
  height = 200,
}: SectionSkeletonProps) {
  const blockStyle: CSSProperties = { height: `${height}px` };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </div>
      <div
        className="animate-pulse bg-muted rounded-md w-full"
        style={blockStyle}
        aria-busy="true"
        aria-label={`Loading ${title}`}
      />
    </div>
  );
}
