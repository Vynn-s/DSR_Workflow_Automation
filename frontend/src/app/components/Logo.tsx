import { useEffect, useState } from "react";
import { Church } from "lucide-react";

export function Logo({ className, alt }: { className?: string; alt?: string }) {
  const [hasLogo, setHasLogo] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setHasLogo(true);
    };
    img.onerror = () => {
      if (!cancelled) setHasLogo(false);
    };
    img.src = "/logo.png";

    return () => {
      cancelled = true;
    };
  }, []);

  if (hasLogo === null) {
    // still checking; render the icon placeholder
    return <div className={className}><Church className="w-8 h-8" /></div>;
  }

  if (hasLogo) {
    return (
      <img src="/logo.png" alt={alt ?? "San Pedro Cathedral Logo"} className={className} />
    );
  }

  // fallback icon
  return <div className={className}><Church className="w-8 h-8" /></div>;
}
