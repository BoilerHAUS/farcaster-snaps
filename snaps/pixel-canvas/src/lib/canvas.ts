import type { DataStore, DataStoreValue } from "@farcaster/snap-turso";

export const PALETTE_COLORS = ["red", "amber", "green", "teal", "blue", "purple"] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

export const DEFAULT_COLOR: PaletteColor = "red";
export const COLS = 16;
export const ROWS = 8;
export const TOTAL_CELLS = COLS * ROWS; // 128
export const PAINT_LIMIT = 3; // max cells per turn
export const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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
 * Skips cells that are already painted — no overpainting allowed.
 * Returns the original canvas reference if nothing changed.
 * Never mutates the input.
 */
export function paintCells(
  canvas: CanvasState,
  cells: Array<{ row: number; col: number }>,
  color: PaletteColor,
): CanvasState {
  if (cells.length === 0) return canvas;
  const paintable = cells.filter(({ row, col }) => canvas[`${row},${col}`] === undefined);
  if (paintable.length === 0) return canvas;
  const next = { ...canvas };
  for (const { row, col } of paintable) {
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

/** Returns ms remaining in cooldown, or 0 if the cooldown has expired. */
export function cooldownRemainingMs(lastPaintMs: number): number {
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastPaintMs));
}

/** Format a cooldown duration in ms as a human-readable string, e.g. "4m 32s". */
export function formatCooldown(ms: number): string {
  const totalSecs = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export async function loadUserLastPaint(store: DataStore, fid: number): Promise<number> {
  const raw = await store.get(`cooldown:${fid}`);
  return typeof raw === "number" ? raw : 0;
}

export async function saveUserLastPaint(store: DataStore, fid: number): Promise<void> {
  await store.set(`cooldown:${fid}`, Date.now());
}

// ── Staged Canvas ─────────────────────────────────────────────────────────────

/** Staged cells expire 15 minutes after being placed if never committed. */
export const STAGE_TTL_MS = 15 * 60 * 1000;

export interface StagedEntry {
  color: PaletteColor;
  fid: number;
  expiresAt: number; // Unix ms
}

/** Sparse map of pending (uncommitted) cells: key = "row,col" */
export type StagedCanvas = Record<string, StagedEntry>;

const STAGED_KEY = "staged";

/** Load staged canvas, silently dropping expired entries. */
export async function loadStagedCanvas(store: DataStore): Promise<StagedCanvas> {
  const raw = await store.get(STAGED_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const now = Date.now();
  const result: StagedCanvas = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const e = val as Record<string, unknown>;
    if (
      typeof e.fid !== "number" ||
      !isValidColor(e.color) ||
      typeof e.expiresAt !== "number" ||
      e.expiresAt <= now
    ) continue;
    result[key] = { fid: e.fid, color: e.color as PaletteColor, expiresAt: e.expiresAt };
  }
  return result;
}

export async function saveStagedCanvas(store: DataStore, staged: StagedCanvas): Promise<void> {
  await store.set(STAGED_KEY, staged as unknown as DataStoreValue);
}

/** How many cells a given FID has staged. */
export function userStagedCount(staged: StagedCanvas, fid: number): number {
  return Object.values(staged).filter((e) => e.fid === fid).length;
}

/** Remove all staged cells belonging to fid. Never mutates. */
export function clearUserStaged(staged: StagedCanvas, fid: number): StagedCanvas {
  if (userStagedCount(staged, fid) === 0) return staged;
  const next: StagedCanvas = {};
  for (const [key, entry] of Object.entries(staged)) {
    if (entry.fid !== fid) next[key] = entry;
  }
  return next;
}

/**
 * Stage cells for a user.
 * Skips cells already committed OR staged by anyone else.
 * Respects the PAINT_LIMIT per FID.
 * Returns the original reference if nothing was added.
 */
export function stageUserCells(
  staged: StagedCanvas,
  canvas: CanvasState,
  cells: Array<{ row: number; col: number }>,
  color: PaletteColor,
  fid: number,
): StagedCanvas {
  const used = userStagedCount(staged, fid);
  const budget = PAINT_LIMIT - used;
  if (budget <= 0 || cells.length === 0) return staged;

  const expiresAt = Date.now() + STAGE_TTL_MS;
  const paintable = cells
    .filter(({ row, col }) => {
      const key = `${row},${col}`;
      return canvas[key] === undefined && staged[key] === undefined;
    })
    .slice(0, budget);

  if (paintable.length === 0) return staged;

  const next = { ...staged };
  for (const { row, col } of paintable) {
    next[`${row},${col}`] = { color, fid, expiresAt };
  }
  return next;
}

/**
 * Commit a user's staged cells to the main canvas.
 * Cells taken by others during staging are skipped (no-overpainting).
 * All of the user's staged entries are removed regardless.
 * Never mutates inputs.
 */
export function commitUserStaged(
  canvas: CanvasState,
  staged: StagedCanvas,
  fid: number,
): { newCanvas: CanvasState; newStaged: StagedCanvas; committed: number; staged: number } {
  const userEntries = Object.entries(staged).filter(([, e]) => e.fid === fid);
  if (userEntries.length === 0) {
    return { newCanvas: canvas, newStaged: staged, committed: 0, staged: 0 };
  }

  const newCanvas = { ...canvas };
  const newStaged = { ...staged };
  let committed = 0;

  for (const [key, entry] of userEntries) {
    delete newStaged[key];
    if (newCanvas[key] === undefined) {
      newCanvas[key] = entry.color;
      committed++;
    }
  }

  return { newCanvas, newStaged, committed, staged: userEntries.length };
}

/**
 * Merge committed and staged cells for display.
 * Both sets are shown — staged visible to all users so they can see others' intent.
 * Committed cells take priority (sets are disjoint by design, but just in case).
 */
export function buildDisplayCanvas(canvas: CanvasState, staged: StagedCanvas): CanvasState {
  if (Object.keys(staged).length === 0) return canvas;
  const stagingColors: CanvasState = {};
  for (const [key, entry] of Object.entries(staged)) {
    stagingColors[key] = entry.color;
  }
  return { ...stagingColors, ...canvas };
}

// ── Gallery ───────────────────────────────────────────────────────────────────

export const MAX_GALLERY = 10;

export interface GalleryEntry {
  canvas: CanvasState;
  completedAt: number; // Unix ms
  clearedBy: number;   // FID
}

/**
 * Save a snapshot of the completed canvas to the gallery ring buffer.
 * Oldest entry is evicted once MAX_GALLERY entries exist.
 */
export async function saveSnapshot(
  store: DataStore,
  canvas: CanvasState,
  clearedBy: number,
): Promise<void> {
  const countRaw = await store.get("gallery:count");
  const count = typeof countRaw === "number" ? countRaw : 0;
  const entry: GalleryEntry = { canvas, completedAt: Date.now(), clearedBy };
  await store.set(`gallery:${count % MAX_GALLERY}`, entry as unknown as DataStoreValue);
  await store.set("gallery:count", count + 1);
}

/** Total number of completed canvases ever saved. */
export async function loadGalleryCount(store: DataStore): Promise<number> {
  const raw = await store.get("gallery:count");
  return typeof raw === "number" ? raw : 0;
}

/**
 * Load the Nth most recent completed canvas (0 = most recent).
 * Pass `totalCount` from loadGalleryCount to avoid a second DB round-trip.
 * Returns null if displayPage is out of range or data is invalid.
 */
export async function loadGalleryEntry(
  store: DataStore,
  totalCount: number,
  displayPage: number,
): Promise<GalleryEntry | null> {
  const available = Math.min(totalCount, MAX_GALLERY);
  if (totalCount === 0 || displayPage < 0 || displayPage >= available) return null;
  const storeIdx = (totalCount - 1 - displayPage) % MAX_GALLERY;
  const raw = await store.get(`gallery:${storeIdx}`);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.completedAt !== "number" || typeof e.clearedBy !== "number") return null;
  return {
    canvas: (e.canvas as CanvasState) ?? {},
    completedAt: e.completedAt,
    clearedBy: e.clearedBy,
  };
}

/** Format a Unix ms timestamp as a human-readable UTC string, e.g. "Apr 12, 2026 20:45 UTC" */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
}
