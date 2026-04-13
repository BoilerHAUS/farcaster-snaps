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
  type PaletteColor,
  parseGridTap,
  isValidColor,
  paintCells,
  buildCellsArray,
  paintedCount,
  loadCanvas,
  saveCanvas,
  loadUserColor,
  saveUserColor,
} from "./lib/canvas.js";

const store = createTursoDataStore();

const app = new Hono();

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

  if (action === ACTION.CLEAR) {
    await saveCanvas(store, {});
    return renderCanvas(base, {}, DEFAULT_COLOR);
  }

  // Default: paint
  const colorRaw = inputs["color"];
  const color: PaletteColor = isValidColor(colorRaw) ? colorRaw : await loadUserColor(store, fid);
  const tappedCells = parseGridTap(inputs["grid_tap"]);

  if (tappedCells.length > 0) {
    const updated = paintCells(canvas, tappedCells, color);
    await saveCanvas(store, updated);
    await saveUserColor(store, fid, color);
    return renderCanvas(base, updated, color);
  }

  // No cells selected — just refresh with their color preference saved
  await saveUserColor(store, fid, color);
  return renderCanvas(base, canvas, color);
};

function renderCanvas(
  base: string,
  canvas: Record<string, PaletteColor>,
  activeColor: PaletteColor,
): SnapHandlerResult {
  const count = paintedCount(canvas);
  const cells = buildCellsArray(canvas);

  return {
    version: "2.0",
    theme: { accent: "teal" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {},
          children: ["title", "status", "color_picker", "canvas", "btn_row"],
        },
        title: {
          type: "text",
          props: { content: "Pixel Canvas", weight: "bold" },
        },
        status: {
          type: "text",
          props: {
            content: `${count} / ${TOTAL_CELLS} cells painted`,
            size: "sm",
          },
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
          props: { label: "Clear Canvas" },
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
