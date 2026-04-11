export function formatMarketCap(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "$?";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function isValidAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const num = Number(trimmed);
  return !isNaN(num) && num > 0 && /^\d+(\.\d+)?$/.test(trimmed);
}

export function formatAmount(value: string): string {
  const trimmed = value.trim();
  const num = Number(trimmed);
  if (isNaN(num)) return trimmed;
  // Remove unnecessary trailing decimal zeros
  return String(num);
}
