import type { SnapElementInput } from "@farcaster/snap";

/**
 * Pixel coin sprite — 8 cols × 5 rows, Game Boy green palette.
 * Coin outline in "green", dollar highlight in "amber".
 */
export function coinSprite(): SnapElementInput {
  return {
    type: "cell_grid",
    props: {
      cols: 8,
      rows: 5,
      rowHeight: 12,
      gap: "none",
      cells: [
        // Row 0: top arc
        { row: 0, col: 1, color: "green" },
        { row: 0, col: 2, color: "green" },
        { row: 0, col: 3, color: "green" },
        { row: 0, col: 4, color: "green" },
        { row: 0, col: 5, color: "green" },
        { row: 0, col: 6, color: "green" },
        // Row 1: sides
        { row: 1, col: 0, color: "green" },
        { row: 1, col: 7, color: "green" },
        // Row 2: sides + dollar symbol
        { row: 2, col: 0, color: "green" },
        { row: 2, col: 3, color: "amber", content: "$" },
        { row: 2, col: 4, color: "amber", content: "$" },
        { row: 2, col: 7, color: "green" },
        // Row 3: sides
        { row: 3, col: 0, color: "green" },
        { row: 3, col: 7, color: "green" },
        // Row 4: bottom arc
        { row: 4, col: 1, color: "green" },
        { row: 4, col: 2, color: "green" },
        { row: 4, col: 3, color: "green" },
        { row: 4, col: 4, color: "green" },
        { row: 4, col: 5, color: "green" },
        { row: 4, col: 6, color: "green" },
      ],
    },
  };
}

/**
 * Celebration sparkle grid for success screen — 8 cols × 4 rows.
 * Stars in amber, sparkles in green, on a sparse grid.
 */
export function sparkleSprite(): SnapElementInput {
  return {
    type: "cell_grid",
    props: {
      cols: 8,
      rows: 4,
      rowHeight: 18,
      gap: "sm",
      cells: [
        { row: 0, col: 0, color: "amber", content: "*" },
        { row: 0, col: 3, color: "amber", content: "*" },
        { row: 0, col: 6, color: "amber", content: "*" },
        { row: 1, col: 1, color: "green" },
        { row: 1, col: 4, color: "green" },
        { row: 1, col: 7, color: "green" },
        { row: 2, col: 2, color: "amber", content: "*" },
        { row: 2, col: 5, color: "amber", content: "*" },
        { row: 3, col: 0, color: "green" },
        { row: 3, col: 3, color: "green" },
        { row: 3, col: 6, color: "green" },
      ],
    },
  };
}
