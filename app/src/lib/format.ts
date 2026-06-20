/** Presentation helpers (mock formatting; locale-aware). */

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDateLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function formatDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}
