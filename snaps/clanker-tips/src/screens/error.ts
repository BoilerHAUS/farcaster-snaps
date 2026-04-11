import type { SnapHandlerResult } from "@farcaster/snap";
import { stepTarget } from "../lib/params.js";

export function errorScreen(base: string, message: string, backStep = "home"): SnapHandlerResult {
  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["error_text", "back_btn"],
        },
        error_text: {
          type: "text",
          props: { content: `! ${message}`, size: "md" },
        },
        back_btn: {
          type: "button",
          props: { label: "< BACK", variant: "secondary" },
          on: {
            press: {
              action: "submit",
              params: { target: stepTarget(base, backStep) },
            },
          },
        },
      },
    },
  };
}
