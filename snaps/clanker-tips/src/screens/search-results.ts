import type { SnapHandlerResult, SnapElementInput } from "@farcaster/snap";
import type { ClankerToken } from "../lib/clanker.js";
import { formatMarketCap } from "../lib/format.js";
import { buildTarget } from "../lib/params.js";

type ResultsOpts = {
  tokens: ClankerToken[];
  recipientFid: number;
  recipientUsername: string;
  query: string;
  backStep: string;
};

export function searchResultsScreen(opts: ResultsOpts): SnapHandlerResult {
  const { tokens, recipientFid, recipientUsername, query, backStep } = opts;

  const recipientLabel =
    recipientUsername && !recipientUsername.match(/^\d+$/)
      ? `@${recipientUsername} (FID ${recipientFid})`
      : `FID ${recipientFid}`;

  const elements: Record<string, SnapElementInput> = {
    page: {
      type: "stack",
      props: { direction: "vertical", gap: "md" },
      children: ["header", "recipient_badge"],
    },
    header: {
      type: "text",
      props: { content: `RESULTS: "${query}"`, weight: "bold" },
    },
    recipient_badge: {
      type: "badge",
      props: { label: `Tipping: ${recipientLabel}`, color: "green" },
    },
  };

  if (tokens.length === 0) {
    (elements["page"] as { children: string[] }).children.push(
      "empty_text",
      "back_btn"
    );
    elements["empty_text"] = {
      type: "text",
      props: {
        content: `No Clanker tokens found for "${query}". Try another name or symbol.`,
        size: "sm",
      },
    };
  } else {
    // Up to 6 tokens (item_group max children = 6)
    const slice = tokens.slice(0, 6);
    const groupChildren: string[] = [];

    slice.forEach((token, i) => {
      const itemKey = `token_item_${i}`;
      const btnKey = `token_btn_${i}`;
      const mcap = token.related.market?.market_cap ?? token.starting_market_cap;
      const warnFlag = token.warnings.length > 0 ? " !" : "";

      const target = buildTarget("tip", {
        fid: recipientFid,
        username: recipientUsername,
        addr: token.contract_address,
        name: token.name,
        sym: token.symbol,
      });

      elements[itemKey] = {
        type: "item",
        props: {
          title: `${token.name}${warnFlag}`,
          description: `$${token.symbol} · ${formatMarketCap(mcap)}`,
        },
        children: [btnKey],
      };

      elements[btnKey] = {
        type: "button",
        props: { label: "TIP >", variant: "secondary" },
        on: { press: { action: "submit", params: { target } } },
      };

      groupChildren.push(itemKey);
    });

    elements["results_group"] = {
      type: "item_group",
      props: { separator: true },
      children: groupChildren,
    };

    (elements["page"] as { children: string[] }).children.push(
      "results_group",
      "back_btn"
    );
  }

  elements["back_btn"] = {
    type: "button",
    props: { label: "< BACK", variant: "secondary" },
    on: {
      press: {
        action: "submit",
        params: { target: `/?step=${backStep}` },
      },
    },
  };

  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: { root: "page", elements },
  };
}
