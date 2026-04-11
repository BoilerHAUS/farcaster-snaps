import type { SnapHandlerResult } from "@farcaster/snap";

/** Token search screen for "tip dev" flow — recipient is pre-fixed to @boiler. */
export function devSearchScreen(): SnapHandlerResult {
  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["title", "subtitle", "token_input", "search_btn", "back_btn"],
        },
        title: {
          type: "text",
          props: { content: ">>> TIP @boiler <<<", weight: "bold", size: "lg" },
        },
        subtitle: {
          type: "badge",
          props: { label: "support the dev  :)", color: "green" },
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
            press: {
              action: "submit",
              params: { target: "/?step=dev-search" },
            },
          },
        },
        back_btn: {
          type: "button",
          props: { label: "< BACK", variant: "secondary" },
          on: {
            press: { action: "submit", params: { target: "/" } },
          },
        },
      },
    },
  };
}
