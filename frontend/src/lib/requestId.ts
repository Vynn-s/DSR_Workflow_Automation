export function formatRequestId(id: string) {
  if (/^REQ-/i.test(id)) {
    return id.toUpperCase();
  }

  const compactId = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `REQ-${compactId}`;
}