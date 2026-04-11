import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import type { SnapFunction } from "@farcaster/snap";
import { registerSnapHandler } from "@farcaster/snap-hono";

import { homeScreen } from "./screens/home.js";
import { devSearchScreen } from "./screens/dev-search.js";
import { searchResultsScreen } from "./screens/search-results.js";
import { tipAmountScreen } from "./screens/tip-amount.js";
import { confirmScreen } from "./screens/confirm.js";
import { successScreen } from "./screens/success.js";
import { errorScreen } from "./screens/error.js";

import { searchTokens } from "./lib/clanker.js";
import { resolveRecipient } from "./lib/farcaster.js";
import { isValidAmount, formatAmount } from "./lib/format.js";
import { extractTipState, P } from "./lib/params.js";

/** Farcaster FID for @boiler (the snap creator). */
const DEV_FID = 14217;
const DEV_USERNAME = "boiler";

const snap: SnapFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const step = url.searchParams.get(P.STEP) ?? "home";

  // ── GET requests (initial load or success navigation) ──────────────────────
  if (ctx.action.type === "get") {
    if (step === "success") {
      const state = extractTipState(url.searchParams);
      const amount = url.searchParams.get(P.AMOUNT) ?? "?";
      if (!state) return homeScreen();
      return successScreen(state, amount);
    }
    return homeScreen();
  }

  // ── POST requests (all button submit actions) ──────────────────────────────
  const inputs = ctx.action.inputs;

  switch (step) {
    // Home search: resolve recipient + search tokens
    case "search": {
      const recipientRaw = String(inputs["r"] ?? "").trim();
      const query = String(inputs["q"] ?? "").trim();

      if (!recipientRaw) {
        return errorScreen("Enter a username or FID to tip.", "home");
      }
      if (!query) {
        return errorScreen("Enter a token name or symbol to search.", "home");
      }

      const [recipient, tokens] = await Promise.all([
        resolveRecipient(recipientRaw),
        searchTokens(query),
      ]);

      if (!recipient) {
        return errorScreen(
          `Could not find user "${recipientRaw}". Check the username or FID.`,
          "home"
        );
      }

      return searchResultsScreen({
        tokens,
        recipientFid: recipient.fid,
        recipientUsername: recipient.username,
        query,
        backStep: "home",
      });
    }

    // Dev search: recipient is hardcoded to @boiler
    case "dev-search": {
      const query = String(inputs["q"] ?? "").trim();
      if (!query) return devSearchScreen();

      const tokens = await searchTokens(query);

      return searchResultsScreen({
        tokens,
        recipientFid: DEV_FID,
        recipientUsername: DEV_USERNAME,
        query,
        backStep: "dev",
      });
    }

    // "Tip dev" shortcut button on home
    case "dev": {
      return devSearchScreen();
    }

    // Token selected from results — show tip amount screen
    case "tip": {
      const state = extractTipState(url.searchParams);
      if (!state) return homeScreen();
      return tipAmountScreen(state);
    }

    // Custom amount submitted — validate and show confirm screen
    case "confirm": {
      const state = extractTipState(url.searchParams);
      if (!state) return homeScreen();

      const rawAmt = String(inputs["amt"] ?? "").trim();

      if (!isValidAmount(rawAmt)) {
        return confirmScreen({
          state,
          amount: rawAmt || "?",
          errorMsg: "! Enter a valid positive number, e.g. 250",
        });
      }

      return confirmScreen({ state, amount: formatAmount(rawAmt) });
    }

    // "I SENT IT!" button — show success screen with confetti
    case "success": {
      const state = extractTipState(url.searchParams);
      const amount = url.searchParams.get(P.AMOUNT) ?? "?";
      if (!state) return homeScreen();
      return successScreen(state, amount);
    }

    // Anything else — back to home
    default:
      return homeScreen();
  }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(__dir, "../assets/fonts");

const app = new Hono();

registerSnapHandler(app, snap, {
  og: {
    fonts: [
      { path: join(fontsDir, "inter-latin-400-normal.woff"), weight: 400 },
      { path: join(fontsDir, "inter-latin-700-normal.woff"), weight: 700 },
    ],
  },
});

export default app;
