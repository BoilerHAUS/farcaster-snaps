import type { SnapHandlerResult } from "@farcaster/snap";
import type { TipState } from "../lib/params.js";
import { buildTarget, caip19 } from "../lib/params.js";

const PRESET_AMOUNTS = ["100", "500", "1000", "5000"] as const;

export function tipAmountScreen(state: TipState): SnapHandlerResult {
  const tokenCaip19 = caip19(state.addr);
  const confirmTarget = buildTarget("confirm", state);

  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: [
            "title",
            "token_badge",
            "recipient_badge",
            "presets",
            "custom_row",
            "back_btn",
          ],
        },
        title: {
          type: "text",
          props: { content: "CHOOSE AMOUNT", weight: "bold" },
        },
        token_badge: {
          type: "badge",
          props: { label: `$${state.sym} — ${state.name}`, color: "green" },
        },
        recipient_badge: {
          type: "badge",
          props: {
            label: state.username && !state.username.match(/^\d+$/)
              ? `Tip: @${state.username}`
              : `Tip: FID ${state.fid}`,
            color: "gray",
          },
        },
        presets: {
          type: "stack",
          props: { direction: "horizontal", gap: "sm" },
          children: PRESET_AMOUNTS.map((amt) => `btn_${amt}`),
        },
        ...Object.fromEntries(
          PRESET_AMOUNTS.map((amt) => [
            `btn_${amt}`,
            {
              type: "button",
              props: { label: amt, variant: "secondary" as const },
              on: {
                press: {
                  action: "send_token",
                  params: {
                    token: tokenCaip19,
                    recipientFid: state.fid,
                    amount: amt,
                  },
                },
              },
            },
          ])
        ),
        custom_row: {
          type: "stack",
          props: { direction: "horizontal", gap: "sm" },
          children: ["custom_input", "send_btn"],
        },
        custom_input: {
          type: "input",
          props: {
            name: "amt",
            label: "Custom amount",
            placeholder: "e.g. 250",
            maxLength: 20,
          },
        },
        send_btn: {
          type: "button",
          props: { label: "SEND >", variant: "primary" },
          on: {
            press: { action: "submit", params: { target: confirmTarget } },
          },
        },
        back_btn: {
          type: "button",
          props: { label: "< BACK", variant: "secondary" },
          on: {
            press: { action: "submit", params: { target: "/?step=home" } },
          },
        },
      },
    },
  };
}
