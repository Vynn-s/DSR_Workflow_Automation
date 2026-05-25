import { useEffect, useRef } from "react";

type ScrollPickerProps = {
  items: Array<string | number>;
  selectedIndex: number;
  onChange: (index: number) => void;
  className?: string;
};

export function ScrollPicker({ items, selectedIndex, onChange, className }: ScrollPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);
  const itemHeight = 44;
  const visibleItemCount = 5;
  const edgePadding = Math.round(((visibleItemCount - 1) / 2) * itemHeight);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const targetTop = selectedIndex * itemHeight;
    container.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }, [selectedIndex, itemHeight]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const centerLine = container.scrollTop + container.clientHeight / 2;
    const relativeCenter = centerLine - edgePadding;
    const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(relativeCenter / itemHeight)));

    if (nextIndex !== selectedIndex) {
      onChange(nextIndex);
    }
  };

  return (
    <div
      className="relative"
      style={{ height: `${visibleItemCount * itemHeight}px` }}
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={[
          "h-full overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 shadow-inner scrollbar-hide snap-y snap-mandatory",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          scrollPaddingTop: `${edgePadding}px`,
          scrollPaddingBottom: `${edgePadding}px`,
        }}
      >
        <div style={{ height: `${edgePadding}px` }} />
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;

          return (
            <button
              key={`${item}-${index}`}
              ref={isSelected ? selectedButtonRef : null}
              type="button"
              onClick={() => onChange(index)}
              style={{ height: `${itemHeight}px` }}
              className={[
                "flex w-full items-center justify-center rounded-lg px-3 text-sm font-medium transition-all snap-center",
                isSelected
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:bg-white hover:text-slate-800",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {item}
            </button>
          );
        })}
        <div style={{ height: `${edgePadding}px` }} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
        <div className="h-11 rounded-none border-y border-emerald-300/70 bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.9)_inset]" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2">
        <div className="h-11 rounded-none bg-gradient-to-b from-white/0 via-white/5 to-white/0" />
      </div>
    </div>
  );
}