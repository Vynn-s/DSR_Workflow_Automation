import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:file:bg-white dark:file:text-zinc-950",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0F3B8C]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
