import type { HubMessage, HubMessagesResponse } from "./types.js";
import type { UserProfile, WalletAddresses, Cast } from "./index.js";

// Farcaster epoch starts Jan 1, 2021 00:00:00 UTC.
const FC_EPOCH = 1_609_459_200;

export function fcTimestampToDate(ts: number): Date {
  return new Date((ts + FC_EPOCH) * 1000);
}

export function toUserProfile(fid: number, messages: HubMessage[]): UserProfile {
  const profile: UserProfile = { fid };

  for (const msg of messages) {
    if (msg.data.type !== "MESSAGE_TYPE_USER_DATA_ADD") continue;
    const body = msg.data.userDataBody;
    if (!body) continue;

    switch (body.type) {
      case "USER_DATA_TYPE_USERNAME":
        profile.username = body.value || undefined;
        break;
      case "USER_DATA_TYPE_DISPLAY":
        profile.displayName = body.value || undefined;
        break;
      case "USER_DATA_TYPE_PFP":
        profile.pfpUrl = body.value || undefined;
        break;
      case "USER_DATA_TYPE_BIO":
        profile.bio = body.value || undefined;
        break;
    }
  }

  return profile;
}

export function toWalletAddresses(messages: HubMessage[]): WalletAddresses {
  const eth: string[] = [];
  const sol: string[] = [];

  for (const msg of messages) {
    const body = msg.data.verificationAddAddressBody;
    if (!body) continue;

    if (body.protocol === "PROTOCOL_ETHEREUM") {
      eth.push(body.address.toLowerCase());
    } else if (body.protocol === "PROTOCOL_SOLANA") {
      sol.push(body.address);
    }
  }

  return { eth, sol };
}

export function toCast(msg: HubMessage): Cast | null {
  if (msg.data.type !== "MESSAGE_TYPE_CAST_ADD") return null;
  const body = msg.data.castAddBody;
  if (!body) return null;

  const embeds = body.embeds
    .filter((e): e is { url: string } => typeof e.url === "string")
    .map((e) => e.url);

  return {
    fid: msg.data.fid,
    hash: msg.hash,
    timestamp: fcTimestampToDate(msg.data.timestamp),
    text: body.text,
    embeds,
    parentFid: body.parentCastId?.fid,
    parentHash: body.parentCastId?.hash,
    parentUrl: body.parentUrl ?? undefined,
    mentions: body.mentions,
  };
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isMessagesResponse(val: unknown): val is HubMessagesResponse {
  return (
    typeof val === "object" &&
    val !== null &&
    "messages" in val &&
    Array.isArray((val as HubMessagesResponse).messages)
  );
}

export function isHubMessage(val: unknown): val is HubMessage {
  return (
    typeof val === "object" &&
    val !== null &&
    "data" in val &&
    "hash" in val &&
    typeof (val as HubMessage).hash === "string"
  );
}
