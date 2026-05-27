import { cn } from "@/lib/utils";

const SIZES = { sm: 72, md: 120, lg: 180 } as const;

type LoadingIndicatorProps = {
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Fill the parent and center on both axes (use for page-level loads). */
  fullPage?: boolean;
};

export function LoadingIndicator({
  label,
  size = "md",
  className,
  fullPage = false,
}: LoadingIndicatorProps) {
  const px = SIZES[size];

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 animate-fade",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        width={px}
        height={px}
        decoding="async"
        className="select-none object-contain drop-shadow-[0_6px_20px_rgba(56,189,248,0.18)]"
        style={{ width: px, height: px }}
        aria-hidden
      />
      {label ? (
        <p className="max-w-[28ch] text-center text-sm font-medium text-muted">
          {label}
        </p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex w-full items-center justify-center" style={{ minHeight: "min(70vh, 720px)" }}>
        {content}
      </div>
    );
  }

  return content;
}
