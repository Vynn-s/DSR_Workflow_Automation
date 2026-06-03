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
  const rafRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const lastReportedIndexRef = useRef<number>(selectedIndex);
  const itemHeight = 44;
  const visibleItemCount = 5;
  const edgePadding = Math.round(((visibleItemCount - 1) / 2) * itemHeight);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    isAutoScrollingRef.current = true;
    const targetTop = selectedIndex * itemHeight;
    container.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });

    const timeoutId = window.setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedIndex, itemHeight]);

  const handleScroll = () => {
    if (isAutoScrollingRef.current) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      const centerLine = container.scrollTop + container.clientHeight / 2;
      const relativeCenter = centerLine - edgePadding;
      const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(relativeCenter / itemHeight)));

      if (nextIndex !== lastReportedIndexRef.current) {
        lastReportedIndexRef.current = nextIndex;
        onChange(nextIndex);
      }
    });
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
          "h-full overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 shadow-inner scrollbar-hide snap-y snap-mandatory dark:border-zinc-800 dark:bg-[#18181b]",
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
                "flex w-full items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors duration-150 snap-center",
                isSelected
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
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
        <div className="h-11 rounded-none border-y border-emerald-500/40 bg-emerald-500/10 backdrop-blur-[0.5px] shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2">
        <div className="h-11 rounded-none bg-gradient-to-b from-zinc-950/0 via-emerald-500/10 to-zinc-950/0" />
      </div>
    </div>
  );
}
