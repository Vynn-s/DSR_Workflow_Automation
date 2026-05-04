import { useEffect, useRef } from "react";

type ScrollPickerProps = {
  items: Array<string | number>;
  selectedIndex: number;
  onChange: (index: number) => void;
  className?: string;
};

export function ScrollPicker({ items, selectedIndex, onChange, className }: ScrollPickerProps) {
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedButtonRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedIndex]);

  return (
    <div
      className={[
        "max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner scrollbar-hide",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;

        return (
          <button
            key={`${item}-${index}`}
            ref={isSelected ? selectedButtonRef : null}
            type="button"
            onClick={() => onChange(index)}
            className={[
              "flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all",
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
    </div>
  );
}