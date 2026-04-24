import { Hono } from "hono";
import type { SnapFunction, SnapHandlerResult } from "@farcaster/snap";
import { registerSnapHandler } from "@farcaster/snap-hono";
import { getWalletAddresses } from "@farcaster-snaps/hub";

import { snapBase } from "./lib/params.js";
import {
  getStakedBalance,
  formatEggs,
  shortAddr,
  BASESCAN_WRITE_URL,
} from "./lib/contract.js";

const app = new Hono();

const snap: SnapFunction = async (ctx): Promise<SnapHandlerResult> => {
  const base = snapBase(ctx.request);

  if (ctx.action.type === "get") {
    return renderLanding(base);
  }

  const { user } = ctx.action;
  const wallets = await getWalletAddresses(user.fid);
  const ethAddrs = wallets.eth;

  if (ethAddrs.length === 0) {
    return renderNoWallets(base);
  }

  const results = await Promise.all(
    ethAddrs.map(async (addr) => ({
      addr,
      balance: await getStakedBalance(addr),
    }))
  );

  const staked = results.filter((r) => r.balance > 0n);

  if (staked.length === 0) {
    return renderNoStake(base, ethAddrs);
  }

  return renderStakeFound(staked);
};

registerSnapHandler(app, snap, {
  openGraph: {
    title: "EGGS Unstaker",
    description:
      "The borodutch EGGS game has shut down. Check your verified wallets and reclaim any staked EGGS tokens.",
  },
});

export default app;

// ─── Screens ─────────────────────────────────────────────────────────────────

function renderLanding(base: string): SnapHandlerResult {
  return {
    version: "2.0",
    theme: { accent: "amber" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["title", "body", "check_btn"],
        },
        title: {
          type: "text",
          props: { content: "EGGS Unstaker", weight: "bold", size: "lg" },
        },
        body: {
          type: "text",
          props: {
            content:
              "The borodutch EGGS game has shut down.\n\nIf you staked EGGS tokens, you can claim them back. Tap below to check your verified wallets.",
          },
        },
        check_btn: {
          type: "button",
          props: { label: "Check My Stake", variant: "primary" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/` },
            },
          },
        },
      },
    },
  };
}

function renderNoWallets(base: string): SnapHandlerResult {
  return {
    version: "2.0",
    theme: { accent: "amber" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["title", "body", "retry_btn"],
        },
        title: {
          type: "text",
          props: { content: "No Verified Wallets", weight: "bold", size: "lg" },
        },
        body: {
          type: "text",
          props: {
            content:
              "Your Farcaster profile has no verified Ethereum wallets.\n\nTo check your stake, go to Warpcast Settings → Verified Addresses and connect the wallet you used to stake. Then tap Retry.",
          },
        },
        retry_btn: {
          type: "button",
          props: { label: "Retry", variant: "primary" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/` },
            },
          },
        },
      },
    },
  };
}

function renderNoStake(base: string, addrs: string[]): SnapHandlerResult {
  const walletList = addrs.map((a) => `• ${shortAddr(a)}`).join("\n");
  return {
    version: "2.0",
    theme: { accent: "amber" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["title", "body", "retry_btn"],
        },
        title: {
          type: "text",
          props: { content: "No Staked EGGS Found", weight: "bold", size: "lg" },
        },
        body: {
          type: "text",
          props: {
            content: `Checked ${addrs.length} wallet(s):\n${walletList}\n\nNone have EGGS staked in the contract. If you used a different wallet, verify it in Warpcast settings first.`,
          },
        },
        retry_btn: {
          type: "button",
          props: { label: "Check Again", variant: "secondary" },
          on: {
            press: {
              action: "submit",
              params: { target: `${base}/` },
            },
          },
        },
      },
    },
  };
}

function renderStakeFound(
  staked: { addr: string; balance: bigint }[]
): SnapHandlerResult {
  const total = staked.reduce((acc, r) => acc + r.balance, 0n);

  const walletLines = staked
    .map((r) => `• ${shortAddr(r.addr)}: ${formatEggs(r.balance)} EGGS`)
    .join("\n");

  const multiNote =
    staked.length > 1
      ? "\n\nYou have stakes in multiple wallets — you'll need to call unstake() from each one separately on Basescan."
      : "";

  return {
    version: "2.0",
    theme: { accent: "green" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { direction: "vertical", gap: "md" },
          children: ["title", "total", "wallets", "instructions", "unstake_btn"],
        },
        title: {
          type: "text",
          props: { content: "Staked EGGS Found!", weight: "bold", size: "lg" },
        },
        total: {
          type: "text",
          props: {
            content: `Total: ${formatEggs(total)} EGGS`,
            weight: "bold",
          },
        },
        wallets: {
          type: "text",
          props: { content: walletLines },
        },
        instructions: {
          type: "text",
          props: {
            content: `Tap below to open Basescan. Connect the wallet shown above, find the unstake() function, and submit — no parameters needed.${multiNote}`,
          },
        },
        unstake_btn: {
          type: "button",
          props: { label: "Unstake on Basescan", variant: "primary" },
          on: {
            press: {
              action: "open_url",
              params: { target: BASESCAN_WRITE_URL },
            },
          },
        },
      },
    },
  };
}
