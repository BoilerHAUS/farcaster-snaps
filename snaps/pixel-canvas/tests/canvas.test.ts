import { describe, it, expect } from "vitest";
import { createInMemoryDataStore } from "@farcaster/snap-turso";
import {
  parseGridTap,
  isValidColor,
  paintCells,
  buildCellsArray,
  paintedCount,
  cooldownRemainingMs,
  formatCooldown,
  formatTimestamp,
  saveSnapshot,
  loadGalleryCount,
  loadGalleryEntry,
  loadStagedCanvas,
  saveStagedCanvas,
  userStagedCount,
  clearUserStaged,
  stageUserCells,
  commitUserStaged,
  buildDisplayCanvas,
  PAINT_LIMIT,
  MAX_GALLERY,
  COLS,
  ROWS,
  COOLDOWN_MS,
} from "../src/lib/canvas.js";

describe("parseGridTap", () => {
  it("returns empty array for empty string", () => {
    expect(parseGridTap("")).toEqual([]);
  });

  it("returns empty array for non-string input", () => {
    expect(parseGridTap(null)).toEqual([]);
    expect(parseGridTap(undefined)).toEqual([]);
    expect(parseGridTap(42)).toEqual([]);
  });

  it("parses a single cell", () => {
    expect(parseGridTap("2,5")).toEqual([{ row: 2, col: 5 }]);
  });

  it("parses multiple cells separated by pipe", () => {
    expect(parseGridTap("0,0|1,3|7,15")).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 3 },
      { row: 7, col: 15 },
    ]);
  });

  it("filters out-of-range cells", () => {
    expect(parseGridTap(`${ROWS},0|0,${COLS}|-1,0|0,-1`)).toEqual([]);
  });

  it("filters malformed entries but keeps valid ones", () => {
    expect(parseGridTap("abc|1,2|xyz")).toEqual([{ row: 1, col: 2 }]);
  });

  it("handles boundary cells (top-left and bottom-right)", () => {
    expect(parseGridTap(`0,0|${ROWS - 1},${COLS - 1}`)).toEqual([
      { row: 0, col: 0 },
      { row: ROWS - 1, col: COLS - 1 },
    ]);
  });
});

describe("isValidColor", () => {
  it("accepts valid palette colors", () => {
    expect(isValidColor("red")).toBe(true);
    expect(isValidColor("amber")).toBe(true);
    expect(isValidColor("green")).toBe(true);
    expect(isValidColor("teal")).toBe(true);
    expect(isValidColor("blue")).toBe(true);
    expect(isValidColor("purple")).toBe(true);
  });

  it("rejects invalid colors", () => {
    expect(isValidColor("pink")).toBe(false);
    expect(isValidColor("gray")).toBe(false);
    expect(isValidColor("black")).toBe(false);
    expect(isValidColor("")).toBe(false);
    expect(isValidColor(null)).toBe(false);
    expect(isValidColor(42)).toBe(false);
  });
});

describe("paintCells", () => {
  it("returns same canvas when no cells provided", () => {
    const canvas = { "0,0": "red" as const };
    expect(paintCells(canvas, [], "blue")).toBe(canvas);
  });

  it("does not mutate the original canvas", () => {
    const canvas = { "0,0": "red" as const };
    const result = paintCells(canvas, [{ row: 1, col: 1 }], "blue");
    expect(canvas).toEqual({ "0,0": "red" });
    expect(result).toEqual({ "0,0": "red", "1,1": "blue" });
  });

  it("does not overwrite an already-painted cell", () => {
    const canvas = { "0,0": "red" as const };
    const result = paintCells(canvas, [{ row: 0, col: 0 }], "green");
    expect(result["0,0"]).toBe("red"); // color preserved
    expect(result).toBe(canvas); // same reference — nothing changed
  });

  it("returns original reference when all selected cells are already painted", () => {
    const canvas = { "0,0": "red" as const, "1,1": "blue" as const };
    const result = paintCells(canvas, [{ row: 0, col: 0 }, { row: 1, col: 1 }], "green");
    expect(result).toBe(canvas);
  });

  it("paints empty cells but skips already-painted ones in a mixed selection", () => {
    const canvas = { "0,0": "red" as const };
    const result = paintCells(canvas, [{ row: 0, col: 0 }, { row: 1, col: 1 }], "green");
    expect(result["0,0"]).toBe("red"); // preserved
    expect(result["1,1"]).toBe("green"); // painted
    expect(result).not.toBe(canvas); // new reference — something changed
  });

  it("paints multiple cells at once", () => {
    const canvas = {};
    const cells = [
      { row: 0, col: 0 },
      { row: 3, col: 7 },
      { row: 7, col: 15 },
    ];
    const result = paintCells(canvas, cells, "purple");
    expect(Object.keys(result)).toHaveLength(3);
    expect(result["0,0"]).toBe("purple");
    expect(result["3,7"]).toBe("purple");
    expect(result["7,15"]).toBe("purple");
  });
});

describe("buildCellsArray", () => {
  it("returns empty array for empty canvas", () => {
    expect(buildCellsArray({})).toEqual([]);
  });

  it("converts canvas map to cells array", () => {
    const canvas = { "0,1": "red" as const, "3,5": "blue" as const };
    const cells = buildCellsArray(canvas);
    expect(cells).toHaveLength(2);
    expect(cells).toContainEqual({ row: 0, col: 1, color: "red" });
    expect(cells).toContainEqual({ row: 3, col: 5, color: "blue" });
  });
});

describe("paintedCount", () => {
  it("returns 0 for empty canvas", () => {
    expect(paintedCount({})).toBe(0);
  });

  it("counts painted cells correctly", () => {
    const canvas = { "0,0": "red" as const, "1,1": "blue" as const };
    expect(paintedCount(canvas)).toBe(2);
  });
});

describe("cooldownRemainingMs", () => {
  it("returns 0 when no paint has occurred (lastPaintMs = 0)", () => {
    expect(cooldownRemainingMs(0)).toBe(0);
  });

  it("returns 0 when cooldown has fully expired", () => {
    const expired = Date.now() - COOLDOWN_MS - 1000;
    expect(cooldownRemainingMs(expired)).toBe(0);
  });

  it("returns positive ms when paint was recent", () => {
    const justNow = Date.now();
    const remaining = cooldownRemainingMs(justNow);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(COOLDOWN_MS);
  });

  it("returns approximately correct remaining time at halfway point", () => {
    const halfwayAgo = Date.now() - COOLDOWN_MS / 2;
    const remaining = cooldownRemainingMs(halfwayAgo);
    // Allow 100ms tolerance for test execution time
    expect(remaining).toBeGreaterThan(COOLDOWN_MS / 2 - 100);
    expect(remaining).toBeLessThanOrEqual(COOLDOWN_MS / 2);
  });
});

describe("formatCooldown", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatCooldown(30_000)).toBe("30s");
    expect(formatCooldown(1_000)).toBe("1s");
  });

  it("formats durations over a minute with minutes and seconds", () => {
    expect(formatCooldown(90_000)).toBe("1m 30s");
    expect(formatCooldown(300_000)).toBe("5m 0s");
  });

  it("rounds up partial seconds", () => {
    expect(formatCooldown(1_500)).toBe("2s");
    expect(formatCooldown(61_001)).toBe("1m 2s"); // 62 seconds → 1m 2s
  });
});

describe("formatTimestamp", () => {
  it("formats a known UTC timestamp correctly", () => {
    // 2026-04-12 20:45:00 UTC
    const ms = Date.UTC(2026, 3, 12, 20, 45, 0); // month is 0-indexed
    expect(formatTimestamp(ms)).toBe("Apr 12, 2026 20:45 UTC");
  });

  it("zero-pads hours and minutes", () => {
    const ms = Date.UTC(2026, 0, 5, 9, 3, 0); // Jan 5 09:03
    expect(formatTimestamp(ms)).toBe("Jan 5, 2026 09:03 UTC");
  });
});

describe("gallery storage", () => {
  it("loadGalleryCount returns 0 on empty store", async () => {
    const store = createInMemoryDataStore();
    expect(await loadGalleryCount(store)).toBe(0);
  });

  it("saveSnapshot increments count and stores entry", async () => {
    const store = createInMemoryDataStore();
    const canvas = { "0,0": "red" as const };
    await saveSnapshot(store, canvas, 12345);
    expect(await loadGalleryCount(store)).toBe(1);
  });

  it("loadGalleryEntry returns null when no snapshots exist", async () => {
    const store = createInMemoryDataStore();
    expect(await loadGalleryEntry(store, 0, 0)).toBeNull();
  });

  it("loadGalleryEntry returns the most recent snapshot at page 0", async () => {
    const store = createInMemoryDataStore();
    const canvas1 = { "0,0": "red" as const };
    const canvas2 = { "1,1": "blue" as const };
    await saveSnapshot(store, canvas1, 111);
    await saveSnapshot(store, canvas2, 222);
    const count = await loadGalleryCount(store);
    const entry = await loadGalleryEntry(store, count, 0);
    expect(entry).not.toBeNull();
    expect(entry!.canvas).toEqual(canvas2);
    expect(entry!.clearedBy).toBe(222);
  });

  it("loadGalleryEntry returns older snapshot at page 1", async () => {
    const store = createInMemoryDataStore();
    const canvas1 = { "0,0": "red" as const };
    const canvas2 = { "1,1": "blue" as const };
    await saveSnapshot(store, canvas1, 111);
    await saveSnapshot(store, canvas2, 222);
    const count = await loadGalleryCount(store);
    const entry = await loadGalleryEntry(store, count, 1);
    expect(entry).not.toBeNull();
    expect(entry!.canvas).toEqual(canvas1);
    expect(entry!.clearedBy).toBe(111);
  });

  it("loadGalleryEntry returns null for out-of-range page", async () => {
    const store = createInMemoryDataStore();
    await saveSnapshot(store, {}, 1);
    const count = await loadGalleryCount(store);
    expect(await loadGalleryEntry(store, count, 1)).toBeNull(); // only 1 entry, page 1 OOB
  });

  it("ring buffer evicts oldest entry after MAX_GALLERY snapshots", async () => {
    const store = createInMemoryDataStore();
    for (let i = 0; i < MAX_GALLERY + 1; i++) {
      await saveSnapshot(store, { [`${i},0`]: "red" as const }, i);
    }
    const count = await loadGalleryCount(store);
    expect(count).toBe(MAX_GALLERY + 1);
    // Only MAX_GALLERY entries are accessible
    const oldest = await loadGalleryEntry(store, count, MAX_GALLERY - 1);
    expect(oldest).not.toBeNull();
    // Entry at MAX_GALLERY (11th oldest) is gone
    expect(await loadGalleryEntry(store, count, MAX_GALLERY)).toBeNull();
  });
});

describe("userStagedCount", () => {
  it("returns 0 for empty staged canvas", () => {
    expect(userStagedCount({}, 1)).toBe(0);
  });

  it("counts only cells belonging to the given FID", () => {
    const staged = {
      "0,0": { color: "red" as const, fid: 1, expiresAt: Date.now() + 99999 },
      "1,1": { color: "blue" as const, fid: 2, expiresAt: Date.now() + 99999 },
      "2,2": { color: "green" as const, fid: 1, expiresAt: Date.now() + 99999 },
    };
    expect(userStagedCount(staged, 1)).toBe(2);
    expect(userStagedCount(staged, 2)).toBe(1);
    expect(userStagedCount(staged, 3)).toBe(0);
  });
});

describe("clearUserStaged", () => {
  it("returns same reference when FID has nothing staged", () => {
    const staged = { "0,0": { color: "red" as const, fid: 2, expiresAt: 99999 } };
    expect(clearUserStaged(staged, 1)).toBe(staged);
  });

  it("removes only the given FID's cells", () => {
    const staged = {
      "0,0": { color: "red" as const, fid: 1, expiresAt: 99999 },
      "1,1": { color: "blue" as const, fid: 2, expiresAt: 99999 },
    };
    const result = clearUserStaged(staged, 1);
    expect(result["0,0"]).toBeUndefined();
    expect(result["1,1"]).toBeDefined();
  });
});

describe("stageUserCells", () => {
  const future = Date.now() + 99999;

  it("stages empty cells for a user", () => {
    const result = stageUserCells({}, {}, [{ row: 0, col: 0 }], "red", 1);
    expect(result["0,0"]).toMatchObject({ color: "red", fid: 1 });
  });

  it("returns same reference when nothing can be staged", () => {
    const staged = {};
    const canvas = { "0,0": "red" as const };
    const result = stageUserCells(staged, canvas, [{ row: 0, col: 0 }], "blue", 1);
    expect(result).toBe(staged); // cell already committed
  });

  it("skips cells already staged by anyone", () => {
    const staged = { "0,0": { color: "red" as const, fid: 2, expiresAt: future } };
    const result = stageUserCells(staged, {}, [{ row: 0, col: 0 }], "blue", 1);
    expect(result).toBe(staged); // cell already staged by fid 2
  });

  it("respects PAINT_LIMIT per FID", () => {
    const cells = [0, 1, 2, 3].map((col) => ({ row: 0, col }));
    const result = stageUserCells({}, {}, cells, "red", 1);
    expect(userStagedCount(result, 1)).toBe(PAINT_LIMIT); // capped at 3
  });

  it("respects remaining budget when user already has staged cells", () => {
    const staged = {
      "0,0": { color: "red" as const, fid: 1, expiresAt: future },
      "0,1": { color: "red" as const, fid: 1, expiresAt: future },
    };
    const result = stageUserCells(staged, {}, [{ row: 0, col: 2 }, { row: 0, col: 3 }], "blue", 1);
    expect(userStagedCount(result, 1)).toBe(3); // 2 existing + 1 new (budget was 1)
  });
});

describe("commitUserStaged", () => {
  const future = Date.now() + 99999;

  it("returns unchanged refs when FID has nothing staged", () => {
    const canvas = { "0,0": "red" as const };
    const staged = {};
    const result = commitUserStaged(canvas, staged, 1);
    expect(result.newCanvas).toBe(canvas);
    expect(result.newStaged).toBe(staged);
    expect(result.committed).toBe(0);
  });

  it("commits staged cells to the canvas", () => {
    const staged = { "1,1": { color: "blue" as const, fid: 1, expiresAt: future } };
    const { newCanvas, newStaged, committed } = commitUserStaged({}, staged, 1);
    expect(newCanvas["1,1"]).toBe("blue");
    expect(newStaged["1,1"]).toBeUndefined();
    expect(committed).toBe(1);
  });

  it("skips cells taken by others while staging", () => {
    const canvas = { "1,1": "red" as const }; // committed by someone else
    const staged = { "1,1": { color: "blue" as const, fid: 1, expiresAt: future } };
    const { newCanvas, committed } = commitUserStaged(canvas, staged, 1);
    expect(newCanvas["1,1"]).toBe("red"); // not overwritten
    expect(committed).toBe(0);
  });

  it("does not remove other users' staged cells", () => {
    const staged = {
      "0,0": { color: "red" as const, fid: 1, expiresAt: future },
      "1,1": { color: "blue" as const, fid: 2, expiresAt: future },
    };
    const { newStaged } = commitUserStaged({}, staged, 1);
    expect(newStaged["0,0"]).toBeUndefined(); // fid 1's cell committed
    expect(newStaged["1,1"]).toBeDefined();   // fid 2's cell untouched
  });
});

describe("buildDisplayCanvas", () => {
  const future = Date.now() + 99999;

  it("returns original canvas reference when staged is empty", () => {
    const canvas = { "0,0": "red" as const };
    expect(buildDisplayCanvas(canvas, {})).toBe(canvas);
  });

  it("merges staged cells into display", () => {
    const canvas = { "0,0": "red" as const };
    const staged = { "1,1": { color: "blue" as const, fid: 1, expiresAt: future } };
    const result = buildDisplayCanvas(canvas, staged);
    expect(result["0,0"]).toBe("red");
    expect(result["1,1"]).toBe("blue");
  });

  it("committed cells take priority over staged in display", () => {
    const canvas = { "0,0": "red" as const };
    const staged = { "0,0": { color: "blue" as const, fid: 1, expiresAt: future } };
    const result = buildDisplayCanvas(canvas, staged);
    expect(result["0,0"]).toBe("red");
  });
});

describe("staged canvas persistence", () => {
  it("saves and loads staged canvas round-trip", async () => {
    const store = createInMemoryDataStore();
    const future = Date.now() + 99999;
    const staged = {
      "0,0": { color: "red" as const, fid: 1, expiresAt: future },
    };
    await saveStagedCanvas(store, staged);
    const loaded = await loadStagedCanvas(store);
    expect(loaded["0,0"]).toMatchObject({ color: "red", fid: 1 });
  });

  it("filters expired entries on load", async () => {
    const store = createInMemoryDataStore();
    const staged = {
      "0,0": { color: "red" as const, fid: 1, expiresAt: Date.now() - 1 }, // expired
    };
    await saveStagedCanvas(store, staged);
    const loaded = await loadStagedCanvas(store);
    expect(loaded["0,0"]).toBeUndefined();
  });

  it("returns empty object for empty store", async () => {
    const store = createInMemoryDataStore();
    expect(await loadStagedCanvas(store)).toEqual({});
  });
});
