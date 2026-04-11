import type { SnapHandlerResult, SnapElementInput } from "@farcaster/snap";
import type { TipState } from "../lib/params.js";
import { buildTarget, caip19, P } from "../lib/params.js";

type ConfirmOpts = {
  base: string;
  state: TipState;
  amount: string;
  errorMsg?: string;
};

export function confirmScreen({ base, state, amount, errorMsg }: ConfirmOpts): SnapHandlerResult {
  const recipientLabel =
    state.username && !state.username.match(/^\d+$/)
      ? `@${state.username}`
      : `FID ${state.fid}`;

  const successTarget = buildTarget(base, "success", state, {
    [P.AMOUNT]: amount,
  });

  const tipTarget = buildTarget(base, "tip", state);

  const elements: Record<string, SnapElementInput> = {
    page: {
      type: "stack",
      props: { direction: "vertical", gap: "md" },
      children: ["title", "summary", "hint", "send_btn", "actions_row"],
    },
    title: {
      type: "text",
      props: { content: "CONFIRM TIP", weight: "bold" },
    },
    summary: {
      type: "item",
      props: {
        title: `${amount} $${state.sym}`,
        description: `to ${recipientLabel}`,
      },
    },
    hint: {
      type: "text",
      props: {
        content:
          errorMsg ??
          "Tap SEND to open your wallet, then confirm I SENT IT!",
        size: "sm",
      },
    },
    send_btn: {
      type: "button",
      props: { label: `SEND ${amount} $${state.sym}`, variant: "primary" },
      on: {
        press: {
          action: "send_token",
          params: {
            token: caip19(state.addr),
            recipientFid: state.fid,
            amount,
          },
        },
      },
    },
    actions_row: {
      type: "stack",
      props: { direction: "horizontal", gap: "sm" },
      children: ["back_btn", "sent_btn"],
    },
    back_btn: {
      type: "button",
      props: { label: "< BACK", variant: "secondary" },
      on: {
        press: { action: "submit", params: { target: tipTarget } },
      },
    },
    sent_btn: {
      type: "button",
      props: { label: "I SENT IT!", variant: "secondary" },
      on: {
        press: { action: "submit", params: { target: successTarget } },
      },
    },
  };

  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: { root: "page", elements },
  };
}
