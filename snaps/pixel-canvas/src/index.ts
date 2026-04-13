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
  type PaletteColor,
  parseGridTap,
  isValidColor,
  paintCells,
  buildCellsArray,
  paintedCount,
  cooldownRemainingMs,
  formatCooldown,
  loadCanvas,
  saveCanvas,
  loadUserColor,
  saveUserColor,
  loadUserLastPaint,
  saveUserLastPaint,
} from "./lib/canvas.js";

const store = createTursoDataStore();

const app = new Hono();

const RULES =
  `3 cells/turn  \u00b7  5 min cooldown  \u00b7  SFW only  \u00b7  clear unlocks at 128`;

const snap: SnapFunction = async (ctx): Promise<SnapHandlerResult> => {
  const base = snapBase(ctx.request);
  const url = new URL(ctx.request.url);
  const action = url.searchParams.get("action");

  // ── GET: initial load ────────────────────────────────────────────────────
  if (ctx.action.type === "get") {
    const canvas = await loadCanvas(store);
    return renderCanvas(base, canvas, DEFAULT_COLOR);
  }

  // ── POST: all submit actions ─────────────────────────────────────────────
  const { user, inputs } = ctx.action;
  const fid = user.fid;
  const canvas = await loadCanvas(store);

  // Rule: clear only when canvas is completely full
  if (action === ACTION.CLEAR) {
    const count = paintedCount(canvas);
    if (count < TOTAL_CELLS) {
      return renderCanvas(
        base,
        canvas,
        DEFAULT_COLOR,
        `Canvas must be full to clear (${count} / ${TOTAL_CELLS} painted)`,
      );
    }
    await saveCanvas(store, {});
    return renderCanvas(base, {}, DEFAULT_COLOR);
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
  await Promise.all([
    saveCanvas(store, updated),
    saveUserColor(store, fid, color),
    saveUserLastPaint(store, fid),
  ]);

  const msg = truncated
    ? `Painted ${PAINT_LIMIT} cells (max per turn)`
    : undefined;

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
          children: ["paint_btn", "clear_btn", "share_btn"],
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

registerSnapHandler(app, snap, {
  openGraph: {
    title: "Pixel Canvas",
    description: "A collaborative pixel art canvas — tap cells and paint with others in real time.",
  },
});

export default app;
