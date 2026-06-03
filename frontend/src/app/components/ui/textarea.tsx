import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition-[color,box-shadow] outline-none focus-visible:ring-1 focus-visible:ring-[#0F3B8C] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-100 dark:placeholder:text-zinc-500 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
