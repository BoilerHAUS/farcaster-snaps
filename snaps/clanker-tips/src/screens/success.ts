import type { SnapHandlerResult } from "@farcaster/snap";
import type { TipState } from "../lib/params.js";
import { sparkleSprite } from "../assets/sprites.js";

export function successScreen(base: string, state: TipState, amount: string): SnapHandlerResult {
  const recipientLabel =
    state.username && !state.username.match(/^\d+$/)
      ? `@${state.username}`
      : `FID ${state.fid}`;

  return {
    version: "2.0",
    theme: { accent: "green" },
    effects: ["confetti"],
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["sparkles", "title", "summary", "tip_again_btn"],
        },
        sparkles: sparkleSprite(),
        title: {
          type: "text",
          props: { content: ">>> TIP SENT! <<<", weight: "bold", size: "lg" },
        },
        summary: {
          type: "item",
          props: {
            title: `${amount} $${state.sym}`,
            description: `sent to ${recipientLabel}`,
          },
        },
        tip_again_btn: {
          type: "button",
          props: { label: "TIP AGAIN >", variant: "primary" },
          on: {
            press: { action: "submit", params: { target: `${base}/` } },
          },
        },
      },
    },
  };
}
