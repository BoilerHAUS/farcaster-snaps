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
  type StagedCanvas,
  parseGridTap,
  isValidColor,
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
  loadStagedCanvas,
  saveStagedCanvas,
  userStagedCount,
  clearUserStaged,
  stageUserCells,
  commitUserStaged,
  buildDisplayCanvas,
  saveSnapshot,
  loadGalleryCount,
  loadGalleryEntry,
} from "./lib/canvas.js";

const store = createTursoDataStore();
const app = new Hono();

const OWNER_FID = 14217; // boilerrat — can clear canvas at any time for moderation

const RULES = `3 cells/turn  \u00b7  5 min cooldown  \u00b7  no overpainting  \u00b7  SFW only`;

const snap: SnapFunction = async (ctx): Promise<SnapHandlerResult> => {
  const base = snapBase(ctx.request);
  const url = new URL(ctx.request.url);
  const action = url.searchParams.get("action");

  // ── Gallery — works for GET (shared link) and POST (nav buttons) ──────────
  if (action === ACTION.GALLERY) {
    const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
    const count = await loadGalleryCount(store);
    if (count === 0) {
      const [canvas, staged] = await Promise.all([loadCanvas(store), loadStagedCanvas(store)]);
      return renderCanvas(base, canvas, staged, DEFAULT_COLOR, 0, "No completed canvases yet");
    }
    const maxPage = Math.min(count, MAX_GALLERY) - 1;
    const safePage = Math.min(page, maxPage);
    const entry = await loadGalleryEntry(store, count, safePage);
    if (!entry) {
      const [canvas, staged] = await Promise.all([loadCanvas(store), loadStagedCanvas(store)]);
      return renderCanvas(base, canvas, staged, DEFAULT_COLOR, 0, "Gallery entry not found");
    }
    return renderGallery(base, entry, safePage, count);
  }

  // ── GET: initial load ─────────────────────────────────────────────────────
  if (ctx.action.type === "get") {
    const [canvas, staged] = await Promise.all([loadCanvas(store), loadStagedCanvas(store)]);
    return renderCanvas(base, canvas, staged, DEFAULT_COLOR, 0);
  }

  // ── POST: authenticated actions ───────────────────────────────────────────
  const { user, inputs } = ctx.action;
  const fid = user.fid;

  // Return to main canvas from gallery (no paint, just refresh view)
  if (action === ACTION.VIEW) {
    const [canvas, staged, color] = await Promise.all([
      loadCanvas(store),
      loadStagedCanvas(store),
      loadUserColor(store, fid),
    ]);
    return renderCanvas(base, canvas, staged, color, userStagedCount(staged, fid));
  }

  const [canvas, staged] = await Promise.all([loadCanvas(store), loadStagedCanvas(store)]);
  const myStaged = userStagedCount(staged, fid);

  // ── Cancel staging ────────────────────────────────────────────────────────
  if (action === ACTION.CANCEL) {
    const newStaged = clearUserStaged(staged, fid);
    const color = await loadUserColor(store, fid);
    await saveStagedCanvas(store, newStaged);
    return renderCanvas(base, canvas, newStaged, color, 0, "Staged cells cleared");
  }

  // ── Clear canvas ──────────────────────────────────────────────────────────
  if (action === ACTION.CLEAR) {
    const isOwner = fid === OWNER_FID;
    const count = paintedCount(canvas);
    if (!isOwner && count < TOTAL_CELLS) {
      return renderCanvas(
        base, canvas, staged, DEFAULT_COLOR, myStaged,
        `Canvas must be full to clear (${count} / ${TOTAL_CELLS} painted)`,
      );
    }
    await saveSnapshot(store, canvas, fid);
    await saveCanvas(store, {});
    return renderCanvas(
      base, {}, staged, DEFAULT_COLOR, myStaged,
      isOwner ? "Canvas cleared by moderator" : undefined,
    );
  }

  // ── Commit staged cells ───────────────────────────────────────────────────
  if (action === ACTION.COMMIT || action === ACTION.PAINT) {
    const color = await loadUserColor(store, fid);
    if (myStaged === 0) {
      return renderCanvas(base, canvas, staged, color, 0, "Stage some cells first — pick cells and hit Stage");
    }
    const lastPaint = await loadUserLastPaint(store, fid);
    const remaining = cooldownRemainingMs(lastPaint);
    if (remaining > 0) {
      return renderCanvas(
        base, canvas, staged, color, myStaged,
        `Cooldown: ${formatCooldown(remaining)} remaining`,
      );
    }
    const { newCanvas, newStaged, committed, staged: hadStaged } = commitUserStaged(canvas, staged, fid);
    await Promise.all([
      saveCanvas(store, newCanvas),
      saveStagedCanvas(store, newStaged),
      saveUserLastPaint(store, fid),
    ]);
    let msg: string | undefined;
    if (committed === 0) {
      msg = "All your staged cells were taken — no cooldown started";
    } else if (committed < hadStaged) {
      msg = `Painted ${committed} cell(s) — ${hadStaged - committed} were already taken`;
    } else if (committed < PAINT_LIMIT) {
      msg = `Painted ${committed} cell(s) — you can stage up to ${PAINT_LIMIT} next turn!`;
    }
    return renderCanvas(base, newCanvas, newStaged, color, 0, msg);
  }

  // ── Stage cells (default action) ──────────────────────────────────────────
  const colorRaw = inputs["color"];
  const color: PaletteColor = isValidColor(colorRaw) ? colorRaw : await loadUserColor(store, fid);

  const tappedCells = parseGridTap(inputs["grid_tap"]);
  if (tappedCells.length === 0) {
    await saveUserColor(store, fid, color);
    return renderCanvas(base, canvas, staged, color, myStaged);
  }

  const newStaged = stageUserCells(staged, canvas, tappedCells, color, fid);
  const newMyStaged = userStagedCount(newStaged, fid);

  await Promise.all([
    saveStagedCanvas(store, newStaged),
    saveUserColor(store, fid, color),
  ]);

  let msg: string | undefined;
  if (newMyStaged === myStaged && tappedCells.length > 0) {
    msg = "Those cells are already taken — pick empty ones";
  } else if (newMyStaged >= PAINT_LIMIT) {
    msg = `${newMyStaged} cell(s) staged — hit Paint! to commit`;
  } else {
    msg = `${newMyStaged} cell(s) staged — you can add ${PAINT_LIMIT - newMyStaged} more`;
  }

  return renderCanvas(base, canvas, newStaged, color, newMyStaged, msg);
};

function renderCanvas(
  base: string,
  canvas: Record<string, PaletteColor>,
  staged: StagedCanvas,
  activeColor: PaletteColor,
  myStaged: number,
  message?: string,
): SnapHandlerResult {
  const committed = paintedCount(canvas);
  const displayCanvas = buildDisplayCanvas(canvas, staged);
  const cells = buildCellsArray(displayCanvas);
  const isFull = committed >= TOTAL_CELLS;
  const hasMyStaged = myStaged > 0;

  const statusContent = message
    ?? (hasMyStaged
      ? `${myStaged} cell(s) staged — hit Paint! to commit`
      : `${committed} / ${TOTAL_CELLS} cells painted`);

  // Dynamic button row based on whether user has staged cells
  const btnChildren = hasMyStaged
    ? ["stage_btn", "commit_btn", "cancel_btn", "gallery_btn", "share_btn"]
    : ["stage_btn", "clear_btn", "gallery_btn", "share_btn"];

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
          children: btnChildren,
        },
        stage_btn: {
          type: "button",
          props: {
            label: hasMyStaged ? "Stage more" : "Stage",
            variant: "primary",
          },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.STAGE}` },
            },
          },
        },
        commit_btn: {
          type: "button",
          props: { label: "Paint!" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.COMMIT}` },
            },
          },
        },
        cancel_btn: {
          type: "button",
          props: { label: "Cancel" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/?action=${ACTION.CANCEL}` },
            },
          },
        },
        clear_btn: {
          type: "button",
          props: {
            label: isFull ? "Clear Canvas" : `Clear (${committed}/128)`,
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
  const canvasNumber = totalCount - displayPage;
  const hasPrev = displayPage < available - 1;
  const hasNext = displayPage > 0;

  const galleryUrl = (p: number) => `${base}/?action=${ACTION.GALLERY}&page=${p}`;

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
