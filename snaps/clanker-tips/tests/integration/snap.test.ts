import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SnapContext, SnapHandlerResult } from "@farcaster/snap";
import { buildTarget } from "../../src/lib/params.js";

// We import the snap function directly by loading index.ts
// Since index.ts exports a Hono app (default), we test the screens directly
// by importing the individual handler/screen modules.

import { homeScreen } from "../../src/screens/home.js";
import { devSearchScreen } from "../../src/screens/dev-search.js";
import { searchResultsScreen } from "../../src/screens/search-results.js";
import { tipAmountScreen } from "../../src/screens/tip-amount.js";
import { confirmScreen } from "../../src/screens/confirm.js";
import { successScreen } from "../../src/screens/success.js";
import { errorScreen } from "../../src/screens/error.js";
import { searchTokens } from "../../src/lib/clanker.js";
import { resolveRecipient } from "../../src/lib/farcaster.js";

vi.mock("../../src/lib/clanker.js");
vi.mock("../../src/lib/farcaster.js");

const mockToken = {
  id: 1,
  contract_address: "0xabc123",
  name: "Degen",
  symbol: "DEGEN",
  chain_id: 8453,
  deployed_at: "2024-01-01T00:00:00Z",
  pool_address: "0xpool",
  starting_market_cap: 50000,
  warnings: [],
  related: {
    user: { fid: 999, username: "alice", display_name: "Alice" },
    market: { price: 0.001, market_cap: 500000 },
  },
};

function isValidSnapResult(result: SnapHandlerResult): void {
  expect(result.version).toBe("2.0");
  expect(result.ui).toBeDefined();
  expect(result.ui.root).toBeTypeOf("string");
  expect(result.ui.elements).toBeTypeOf("object");
  const rootEl = result.ui.elements[result.ui.root];
  expect(rootEl).toBeDefined();
}

describe("homeScreen", () => {
  it("returns a valid snap response", () => {
    const result = homeScreen("http://localhost:3003");
    isValidSnapResult(result);
  });

  it("has recipient and token search inputs as direct root children", () => {
    const result = homeScreen("http://localhost:3003");
    const els = result.ui.elements;
    expect(els["recipient_input"]).toBeDefined();
    expect((els["recipient_input"] as unknown as { props: { name: string } }).props.name).toBe("r");
    expect(els["token_input"]).toBeDefined();
    expect((els["token_input"] as unknown as { props: { name: string } }).props.name).toBe("q");
    const rootChildren = (els["page"] as unknown as { children: string[] }).children;
    expect(rootChildren).toContain("recipient_input");
    expect(rootChildren).toContain("token_input");
    expect(els["inputs"]).toBeUndefined();
  });

  it("has a search button targeting /?step=search", () => {
    const result = homeScreen("http://localhost:3003");
    const searchBtn = result.ui.elements["search_btn"] as unknown as {
      on: { press: { action: string; params: { target: string } } };
    };
    expect(searchBtn.on.press.action).toBe("submit");
    expect(searchBtn.on.press.params.target).toBe("http://localhost:3003/?step=search");
  });

  it("has a humble dev tip button targeting /?step=dev", () => {
    const result = homeScreen("http://localhost:3003");
    const devBtn = result.ui.elements["devtip_btn"] as unknown as {
      on: { press: { action: string; params: { target: string } } };
    };
    expect(devBtn.on.press.action).toBe("submit");
    expect(devBtn.on.press.params.target).toBe("http://localhost:3003/?step=dev");
  });

  it("uses green accent theme", () => {
    const result = homeScreen("http://localhost:3003");
    expect(result.theme?.accent).toBe("green");
  });
});

describe("devSearchScreen", () => {
  it("returns a valid snap response", () => {
    isValidSnapResult(devSearchScreen("http://localhost:3003"));
  });

  it("mentions @boiler in the title", () => {
    const result = devSearchScreen("http://localhost:3003");
    const title = result.ui.elements["title"] as unknown as { props: { content: string } };
    expect(title.props.content).toContain("boiler");
  });

  it("has a token search input with name q", () => {
    const result = devSearchScreen("http://localhost:3003");
    const input = result.ui.elements["token_input"] as unknown as { props: { name: string } };
    expect(input.props.name).toBe("q");
  });

  it("search button targets /?step=dev-search", () => {
    const result = devSearchScreen("http://localhost:3003");
    const btn = result.ui.elements["search_btn"] as unknown as {
      on: { press: { params: { target: string } } };
    };
    expect(btn.on.press.params.target).toBe("http://localhost:3003/?step=dev-search");
  });
});

describe("searchResultsScreen", () => {
  it("returns valid snap response with tokens", () => {
    const result = searchResultsScreen({ base: "http://localhost:3003",
      tokens: [mockToken],
      recipientFid: 12345,
      recipientUsername: "alice",
      query: "degen",
      backStep: "home",
    });
    isValidSnapResult(result);
  });

  it("shows recipient badge with @username", () => {
    const result = searchResultsScreen({ base: "http://localhost:3003",
      tokens: [mockToken],
      recipientFid: 12345,
      recipientUsername: "alice",
      query: "degen",
      backStep: "home",
    });
    const badge = result.ui.elements["recipient_badge"] as unknown as {
      props: { label: string };
    };
    expect(badge.props.label).toContain("@alice");
    expect(badge.props.label).toContain("12345");
  });

  it("shows empty state when no tokens found", () => {
    const result = searchResultsScreen({ base: "http://localhost:3003",
      tokens: [],
      recipientFid: 12345,
      recipientUsername: "alice",
      query: "unknowntoken",
      backStep: "home",
    });
    isValidSnapResult(result);
    expect(result.ui.elements["empty_text"]).toBeDefined();
    expect(result.ui.elements["results_group"]).toBeUndefined();
  });

  it("each token has a TIP button with submit action", () => {
    const result = searchResultsScreen({ base: "http://localhost:3003",
      tokens: [mockToken],
      recipientFid: 12345,
      recipientUsername: "alice",
      query: "degen",
      backStep: "home",
    });
    const btn = result.ui.elements["token_btn_0"] as unknown as {
      on: { press: { action: string; params: { target: string } } };
    };
    expect(btn.on.press.action).toBe("submit");
    expect(btn.on.press.params.target).toContain("step=tip");
    expect(btn.on.press.params.target).toContain("f=12345");
    expect(btn.on.press.params.target).toContain("a=0xabc123");
  });

  it("shows warning indicator for tokens with warnings", () => {
    const warnToken = { ...mockToken, warnings: ["honeypot"] };
    const result = searchResultsScreen({ base: "http://localhost:3003",
      tokens: [warnToken],
      recipientFid: 12345,
      recipientUsername: "alice",
      query: "degen",
      backStep: "home",
    });
    const item = result.ui.elements["token_item_0"] as unknown as {
      props: { title: string };
    };
    expect(item.props.title).toContain("!");
  });

  it("caps results at 6 tokens", () => {
    const manyTokens = Array.from({ length: 10 }, (_, i) => ({
      ...mockToken,
      id: i,
      contract_address: `0xaddr${i}`,
    }));
    const result = searchResultsScreen({ base: "http://localhost:3003",
      tokens: manyTokens,
      recipientFid: 12345,
      recipientUsername: "alice",
      query: "degen",
      backStep: "home",
    });
    expect(result.ui.elements["token_item_6"]).toBeUndefined();
    expect(result.ui.elements["token_item_5"]).toBeDefined();
  });
});

describe("tipAmountScreen", () => {
  const state = {
    fid: 12345,
    username: "alice",
    addr: "0xabc123",
    name: "Degen",
    sym: "DEGEN",
  };

  it("returns a valid snap response", () => {
    isValidSnapResult(tipAmountScreen("http://localhost:3003", state));
  });

  it("shows token and recipient badges", () => {
    const result = tipAmountScreen("http://localhost:3003", state);
    const tokenBadge = result.ui.elements["token_badge"] as unknown as {
      props: { label: string };
    };
    const recipientBadge = result.ui.elements["recipient_badge"] as unknown as {
      props: { label: string };
    };
    expect(tokenBadge.props.label).toContain("DEGEN");
    expect(recipientBadge.props.label).toContain("@alice");
  });

  it("preset buttons fire send_token actions with correct CAIP-19", () => {
    const result = tipAmountScreen("http://localhost:3003", state);
    const btn100 = result.ui.elements["btn_100"] as unknown as {
      on: {
        press: {
          action: string;
          params: { token: string; amount: string; recipientFid: number };
        };
      };
    };
    expect(btn100.on.press.action).toBe("send_token");
    expect(btn100.on.press.params.token).toBe(
      "eip155:8453/erc20:0xabc123"
    );
    expect(btn100.on.press.params.amount).toBe("100");
    expect(btn100.on.press.params.recipientFid).toBe(12345);
  });

  it("all 4 preset buttons exist", () => {
    const result = tipAmountScreen("http://localhost:3003", state);
    expect(result.ui.elements["btn_100"]).toBeDefined();
    expect(result.ui.elements["btn_500"]).toBeDefined();
    expect(result.ui.elements["btn_1000"]).toBeDefined();
    expect(result.ui.elements["btn_5000"]).toBeDefined();
  });

  it("SEND button submits to confirm step", () => {
    const result = tipAmountScreen("http://localhost:3003", state);
    const sendBtn = result.ui.elements["send_btn"] as unknown as {
      on: { press: { action: string; params: { target: string } } };
    };
    expect(sendBtn.on.press.action).toBe("submit");
    expect(sendBtn.on.press.params.target).toContain("step=confirm");
  });
});

describe("confirmScreen", () => {
  const state = {
    fid: 12345,
    username: "alice",
    addr: "0xabc123",
    name: "Degen",
    sym: "DEGEN",
  };

  it("returns a valid snap response", () => {
    isValidSnapResult(confirmScreen({ base: "http://localhost:3003", state, amount: "500" }));
  });

  it("SEND button fires send_token with correct params", () => {
    const result = confirmScreen({ base: "http://localhost:3003", state, amount: "500" });
    const sendBtn = result.ui.elements["send_btn"] as unknown as {
      on: {
        press: {
          action: string;
          params: { token: string; recipientFid: number; amount: string };
        };
      };
    };
    expect(sendBtn.on.press.action).toBe("send_token");
    expect(sendBtn.on.press.params.token).toBe("eip155:8453/erc20:0xabc123");
    expect(sendBtn.on.press.params.recipientFid).toBe(12345);
    expect(sendBtn.on.press.params.amount).toBe("500");
  });

  it("I SENT IT button navigates to success step", () => {
    const result = confirmScreen({ base: "http://localhost:3003", state, amount: "500" });
    const sentBtn = result.ui.elements["sent_btn"] as unknown as {
      on: { press: { params: { target: string } } };
    };
    expect(sentBtn.on.press.params.target).toContain("step=success");
    expect(sentBtn.on.press.params.target).toContain("m=500");
  });

  it("shows error message when provided", () => {
    const result = confirmScreen({
      base: "http://localhost:3003",
      state,
      amount: "abc",
      errorMsg: "! Enter a valid positive number",
    });
    const hint = result.ui.elements["hint"] as unknown as { props: { content: string } };
    expect(hint.props.content).toContain("!");
  });
});

describe("successScreen", () => {
  const state = {
    fid: 12345,
    username: "alice",
    addr: "0xabc123",
    name: "Degen",
    sym: "DEGEN",
  };

  it("returns a valid snap response", () => {
    isValidSnapResult(successScreen("http://localhost:3003", state, "500"));
  });

  it("includes confetti effect", () => {
    const result = successScreen("http://localhost:3003", state, "500");
    expect(result.effects).toContain("confetti");
  });

  it("shows amount and recipient in summary", () => {
    const result = successScreen("http://localhost:3003", state, "500");
    const summary = result.ui.elements["summary"] as unknown as {
      props: { title: string; description: string };
    };
    expect(summary.props.title).toContain("500");
    expect(summary.props.title).toContain("DEGEN");
    expect(summary.props.description).toContain("@alice");
  });

  it("tip again button navigates to home", () => {
    const result = successScreen("http://localhost:3003", state, "500");
    const btn = result.ui.elements["tip_again_btn"] as unknown as {
      on: { press: { params: { target: string } } };
    };
    expect(btn.on.press.params.target).toBe("http://localhost:3003/");
  });
});

describe("errorScreen", () => {
  it("returns a valid snap response", () => {
    isValidSnapResult(errorScreen("http://localhost:3003", "Something went wrong"));
  });

  it("displays the error message", () => {
    const result = errorScreen("http://localhost:3003", "User not found");
    const txt = result.ui.elements["error_text"] as unknown as { props: { content: string } };
    expect(txt.props.content).toContain("User not found");
  });

  it("back button uses the provided backStep", () => {
    const result = errorScreen("http://localhost:3003", "Oops", "dev");
    const btn = result.ui.elements["back_btn"] as unknown as {
      on: { press: { params: { target: string } } };
    };
    expect(btn.on.press.params.target).toContain("step=dev");
  });
});
