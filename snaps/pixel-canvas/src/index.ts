import { Hono } from "hono";
import type { SnapFunction, SnapHandlerResult } from "@farcaster/snap";
import { registerSnapHandler } from "@farcaster/snap-hono";
import { createTursoDataStore } from "@farcaster/snap-turso";

import { snapBase, ACTION } from "./lib/params.js";
import {
  PALETTE_COLORS,
  DEFAULT_COLOR,
  COLS,
  ROWS,
  TOTAL_CELLS,
  PAINT_LIMIT,
  MAX_GALLERY,
  type PaletteColor,
  type GalleryEntry,
  parseGridTap,
  isValidColor,
  paintCells,
  buildCellsArray,
  paintedCount,
  cooldownRemainingMs,
  formatCooldown,
  formatTimestamp,
  loadCanvas,
  saveCanvas,
  loadUserColor,
  saveUserColor,
  loadUserLastPaint,
  saveUserLastPaint,
  saveSnapshot,
  loadGalleryCount,
  loadGalleryEntry,
} from "./lib/canvas.js";

const store = createTursoDataStore();

const app = new Hono();

const OWNER_FID = 14217; // boilerrat — can clear canvas at any time for moderation

const RULES =
  `3 cells/turn  \u00b7  5 min cooldown  \u00b7  no overpainting  \u00b7  SFW only`;

const snap: SnapFunction = async (ctx): Promise<SnapHandlerResult> => {
  const base = snapBase(ctx.request);
  const url = new URL(ctx.request.url);
  const action = url.searchParams.get("action");

  // ── Gallery view — handles both GET (shared link) and POST (navigation) ────
  if (action === ACTION.GALLERY) {
    const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
    const count = await loadGalleryCount(store);
    if (count === 0) {
      const canvas = await loadCanvas(store);
      return renderCanvas(base, canvas, DEFAULT_COLOR, "No completed canvases yet");
    }
    const maxPage = Math.min(count, MAX_GALLERY) - 1;
    const safePage = Math.min(page, maxPage);
    const entry = await loadGalleryEntry(store, count, safePage);
    if (!entry) {
      const canvas = await loadCanvas(store);
      return renderCanvas(base, canvas, DEFAULT_COLOR, "Gallery entry not found");
    }
    return renderGallery(base, entry, safePage, count);
  }

  // ── GET: initial canvas load ──────────────────────────────────────────────
  if (ctx.action.type === "get") {
    const canvas = await loadCanvas(store);
    return renderCanvas(base, canvas, DEFAULT_COLOR);
  }

  // ── POST actions ──────────────────────────────────────────────────────────
  const { user, inputs } = ctx.action;
  const fid = user.fid;

  // Return to main canvas without painting (from gallery back button)
  if (action === ACTION.VIEW) {
    const [canvas, color] = await Promise.all([
      loadCanvas(store),
      loadUserColor(store, fid),
    ]);
    return renderCanvas(base, canvas, color);
  }

  const canvas = await loadCanvas(store);

  // Rule: clear only when canvas is completely full (owner can always clear)
  if (action === ACTION.CLEAR) {
    const isOwner = fid === OWNER_FID;
    const count = paintedCount(canvas);
    if (!isOwner && count < TOTAL_CELLS) {
      return renderCanvas(
        base,
        canvas,
        DEFAULT_COLOR,
        `Canvas must be full to clear (${count} / ${TOTAL_CELLS} painted)`,
      );
    }
    await saveSnapshot(store, canvas, fid);
    await saveCanvas(store, {});
    return renderCanvas(base, {}, DEFAULT_COLOR, isOwner ? "Canvas cleared by moderator" : undefined);
  }

  // Default: paint
  const colorRaw = inputs["color"];
  const color: PaletteColor = isValidColor(colorRaw) ? colorRaw : await loadUserColor(store, fid);

  // Rule: 5-minute cooldown per FID
  const lastPaint = await loadUserLastPaint(store, fid);
  const remaining = cooldownRemainingMs(lastPaint);
  if (remaining > 0) {
    return renderCanvas(
      base,
      canvas,
      color,
      `Cooldown: ${formatCooldown(remaining)} remaining`,
    );
  }

  const tappedCells = parseGridTap(inputs["grid_tap"]);
  if (tappedCells.length === 0) {
    await saveUserColor(store, fid, color);
    return renderCanvas(base, canvas, color);
  }

  // Rule: max 3 cells per turn
  const limited = tappedCells.slice(0, PAINT_LIMIT);
  const truncated = tappedCells.length > PAINT_LIMIT;

  const updated = paintCells(canvas, limited, color);

  // Rule: no overpainting — if every selected cell was already taken, skip cooldown
  if (updated === canvas) {
    await saveUserColor(store, fid, color);
    return renderCanvas(base, canvas, color, "Those cells are already painted — pick empty ones");
  }

  await Promise.all([
    saveCanvas(store, updated),
    saveUserColor(store, fid, color),
    saveUserLastPaint(store, fid),
  ]);

  const paintedNow = paintedCount(updated) - paintedCount(canvas);
  let msg: string | undefined;
  if (truncated) {
    msg = `Painted ${PAINT_LIMIT} cells (max per turn)`;
  } else if (paintedNow < limited.length) {
    msg = `Painted ${paintedNow} cell${paintedNow !== 1 ? "s" : ""} (some already taken)`;
  }

  return renderCanvas(base, updated, color, msg);
};

function renderCanvas(
  base: string,
  canvas: Record<string, PaletteColor>,
  activeColor: PaletteColor,
  message?: string,
): SnapHandlerResult {
  const count = paintedCount(canvas);
  const cells = buildCellsArray(canvas);
  const isFull = count >= TOTAL_CELLS;

  const statusContent = message ?? `${count} / ${TOTAL_CELLS} cells painted`;

  return {
    version: "2.0",
    theme: { accent: "teal" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {},
          children: ["title", "rules", "status", "color_picker", "canvas", "btn_row"],
        },
        title: {
          type: "text",
          props: { content: "Pixel Canvas", weight: "bold" },
        },
        rules: {
          type: "text",
          props: { content: RULES, size: "sm" },
        },
        status: {
          type: "text",
          props: { content: statusContent, size: "sm" },
        },
        color_picker: {
          type: "toggle_group",
          props: {
            name: "color",
            label: "Active color",
            options: [...PALETTE_COLORS],
            defaultValue: activeColor,
          },
        },
        canvas: {
          type: "cell_grid",
          props: {
            name: "grid_tap",
            cols: COLS,
            rows: ROWS,
            cells,
            gap: "sm",
            rowHeight: 24,
            select: "multiple",
          },
        },
        btn_row: {
          type: "stack",
          props: { direction: "horizontal" },
          children: ["paint_btn", "clear_btn", "gallery_btn", "share_btn"],
        },
        paint_btn: {
          type: "button",
          props: { label: "Paint", variant: "primary" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.PAINT}` },
            },
          },
        },
        clear_btn: {
          type: "button",
          props: {
            label: isFull ? "Clear Canvas" : `Clear (${count}/128)`,
          },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.CLEAR}` },
            },
          },
        },
        gallery_btn: {
          type: "button",
          props: { label: "Gallery" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.GALLERY}&page=0` },
            },
          },
        },
        share_btn: {
          type: "button",
          props: { label: "Share", icon: "share" },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: "Come paint with me on this collaborative pixel canvas!",
                embeds: [base],
              },
            },
          },
        },
      },
    },
  };
}

function renderGallery(
  base: string,
  entry: GalleryEntry,
  displayPage: number,
  totalCount: number,
): SnapHandlerResult {
  const cells = buildCellsArray(entry.canvas);
  const available = Math.min(totalCount, MAX_GALLERY);
  const canvasNumber = totalCount - displayPage; // most recent = highest number
  const hasPrev = displayPage < available - 1; // older entries exist
  const hasNext = displayPage > 0;             // newer entries exist

  const galleryUrl = (p: number) => `${base}/?action=${ACTION.GALLERY}&page=${p}`;

  // Build nav children dynamically so boundary buttons disappear cleanly
  const navChildren: string[] = [];
  if (hasPrev) navChildren.push("prev_btn");
  navChildren.push("share_btn");
  if (hasNext) navChildren.push("next_btn");

  return {
    version: "2.0",
    theme: { accent: "teal" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {},
          children: ["gallery_title", "timestamp_text", "canvas", "nav_row", "back_btn"],
        },
        gallery_title: {
          type: "text",
          props: { content: `Canvas #${canvasNumber}`, weight: "bold" },
        },
        timestamp_text: {
          type: "text",
          props: { content: `Completed ${formatTimestamp(entry.completedAt)}`, size: "sm" },
        },
        canvas: {
          type: "cell_grid",
          props: {
            name: "grid_tap",
            cols: COLS,
            rows: ROWS,
            cells,
            gap: "sm",
            rowHeight: 24,
            select: "multiple",
          },
        },
        nav_row: {
          type: "stack",
          props: { direction: "horizontal" },
          children: navChildren,
        },
        prev_btn: {
          type: "button",
          props: { label: "Older" },
          on: {
            press: {
              action: "submit",
              params: { target: galleryUrl(displayPage + 1) },
            },
          },
        },
        share_btn: {
          type: "button",
          props: { label: "Share", icon: "share" },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: `Check out Canvas #${canvasNumber} — a completed collaborative pixel art on Farcaster!`,
                embeds: [galleryUrl(displayPage)],
              },
            },
          },
        },
        next_btn: {
          type: "button",
          props: { label: "Newer" },
          on: {
            press: {
              action: "submit",
              params: { target: galleryUrl(displayPage - 1) },
            },
          },
        },
        back_btn: {
          type: "button",
          props: { label: "Back to Canvas" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.VIEW}` },
            },
          },
        },
      },
    },
  };
}

registerSnapHandler(app, snap, {
  openGraph: {
    title: "Pixel Canvas",
    description: "A collaborative pixel art canvas — tap cells and paint with others in real time.",
  },
});

export default app;
