import { describe, it, expect } from "vitest";
import {
  parseGridTap,
  isValidColor,
  paintCells,
  buildCellsArray,
  paintedCount,
  cooldownRemainingMs,
  formatCooldown,
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

  it("overwrites an existing cell color", () => {
    const canvas = { "0,0": "red" as const };
    const result = paintCells(canvas, [{ row: 0, col: 0 }], "green");
    expect(result["0,0"]).toBe("green");
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
