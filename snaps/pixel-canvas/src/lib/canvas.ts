import type { DataStore } from "@farcaster/snap-turso";

export const PALETTE_COLORS = ["red", "amber", "green", "teal", "blue", "purple"] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

export const DEFAULT_COLOR: PaletteColor = "red";
export const COLS = 16;
export const ROWS = 8;
export const TOTAL_CELLS = COLS * ROWS; // 128

const CANVAS_KEY = "canvas";

/** Sparse map of painted cells: key = "row,col", value = PaletteColor */
export type CanvasState = Record<string, PaletteColor>;

/**
 * Parse the pipe-delimited "row,col" string that cell_grid sends in inputs.
 * Ignores out-of-range or malformed entries.
 */
export function parseGridTap(raw: unknown): Array<{ row: number; col: number }> {
  if (typeof raw !== "string" || raw.length === 0) return [];
  return raw
    .split("|")
    .flatMap((part) => {
      const comma = part.indexOf(",");
      if (comma === -1) return [];
      const row = Number(part.slice(0, comma));
      const col = Number(part.slice(comma + 1));
      if (!Number.isFinite(row) || !Number.isFinite(col)) return [];
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return [];
      return [{ row, col }];
    });
}

export function isValidColor(value: unknown): value is PaletteColor {
  return typeof value === "string" && (PALETTE_COLORS as readonly string[]).includes(value);
}

/**
 * Return a new canvas with the given cells painted in `color`.
 * Never mutates the input.
 */
export function paintCells(
  canvas: CanvasState,
  cells: Array<{ row: number; col: number }>,
  color: PaletteColor,
): CanvasState {
  if (cells.length === 0) return canvas;
  const next = { ...canvas };
  for (const { row, col } of cells) {
    next[`${row},${col}`] = color;
  }
  return next;
}

/** Convert the sparse canvas map to the cell_grid `cells` array. */
export function buildCellsArray(
  canvas: CanvasState,
): Array<{ row: number; col: number; color: PaletteColor }> {
  return Object.entries(canvas).map(([key, color]) => {
    const comma = key.indexOf(",");
    return {
      row: Number(key.slice(0, comma)),
      col: Number(key.slice(comma + 1)),
      color,
    };
  });
}

export function paintedCount(canvas: CanvasState): number {
  return Object.keys(canvas).length;
}

export async function loadCanvas(store: DataStore): Promise<CanvasState> {
  const raw = await store.get(CANVAS_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CanvasState;
}

export async function saveCanvas(store: DataStore, canvas: CanvasState): Promise<void> {
  await store.set(CANVAS_KEY, canvas);
}

export async function loadUserColor(store: DataStore, fid: number): Promise<PaletteColor> {
  const raw = await store.get(`user:${fid}:color`);
  return isValidColor(raw) ? raw : DEFAULT_COLOR;
}

export async function saveUserColor(
  store: DataStore,
  fid: number,
  color: PaletteColor,
): Promise<void> {
  await store.set(`user:${fid}:color`, color);
}
