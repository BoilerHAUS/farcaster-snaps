import type { SnapHandlerResult } from "@farcaster/snap";
import { coinSprite } from "../assets/sprites.js";

export function homeScreen(): SnapHandlerResult {
  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["title", "coin", "inputs", "search_btn", "devtip_row"],
        },
        title: {
          type: "text",
          props: {
            content: ">>> CLANKER TIPS <<<",
            weight: "bold",
            size: "lg",
          },
        },
        coin: coinSprite(),
        inputs: {
          type: "stack",
          props: { direction: "vertical", gap: "sm" },
          children: ["recipient_input", "token_input"],
        },
        recipient_input: {
          type: "input",
          props: {
            name: "r",
            label: "Who to tip",
            placeholder: "username or FID",
            maxLength: 60,
          },
        },
        token_input: {
          type: "input",
          props: {
            name: "q",
            label: "Token",
            placeholder: "search clanker tokens...",
            maxLength: 60,
          },
        },
        search_btn: {
          type: "button",
          props: { label: "SEARCH >", variant: "primary" },
          on: {
            press: { action: "submit", params: { target: "/?step=search" } },
          },
        },
        devtip_row: {
          type: "stack",
          props: { direction: "horizontal", justify: "end" },
          children: ["devtip_btn"],
        },
        devtip_btn: {
          type: "button",
          props: { label: "[ tip dev ]", variant: "secondary" },
          on: {
            press: { action: "submit", params: { target: "/?step=dev" } },
          },
        },
      },
    },
  };
}
