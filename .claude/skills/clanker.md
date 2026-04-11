# Clanker Skill

Build and integrate with Clanker — the multi-chain ERC-20 token platform on Base (and beyond).
Covers the public REST API (no auth), authenticated REST API, and the `clanker-sdk` for
server-side token deployment.

---

## Overview

Clanker deploys ERC-20 tokens with automatic Uniswap V4 liquidity pools. Each token has:
- A contract address on Base (primary), Arbitrum, Unichain, BSC, Ethereum, Monad, Abstract
- An LP pool paired with WETH (default) or a custom quote token
- Configurable fee splits (LP rewards) and optional vesting vaults

**Base URL:** `https://www.clanker.world/api`

---

## Public REST API (no auth required)

### Search tokens

```
GET /tokens
```

| Param | Type | Notes |
|---|---|---|
| `q` | string | Search by name or symbol |
| `fid` | number | Filter by creator Farcaster FID |
| `fids` | string | Comma-separated FIDs |
| `pairAddress` | string | Filter by paired token address |
| `chainId` | number | 8453=Base, 42161=Arbitrum, 130=Unichain |
| `sort` | string | `desc` (default) or `asc` |
| `sortBy` | string | `created_at`, `market_cap`, `volume` |
| `limit` | number | Max 20 |
| `cursor` | string | Pagination cursor from previous response |
| `includeUser` | boolean | Include creator profile data |
| `includeMarket` | boolean | Include market cap / price data |
| `startDate` | string | ISO date filter |

**Response:**
```json
{
  "tokens": [
    {
      "id": 123,
      "contract_address": "0x...",
      "name": "My Token",
      "symbol": "MYT",
      "chain_id": 8453,
      "deployed_at": "2024-01-01T00:00:00Z",
      "pool_address": "0x...",
      "starting_market_cap": 10000,
      "warnings": [],
      "related": {
        "user": { "fid": 123, "username": "alice", "display_name": "Alice" },
        "market": { "price": 0.001, "market_cap": 50000 }
      }
    }
  ],
  "nextCursor": "abc123"
}
```

---

### Search by creator

```
GET /search-creator?q=<username_or_0xaddress>
```

| Param | Type | Notes |
|---|---|---|
| `q` | string | **Required.** Farcaster username or wallet address |
| `limit` | number | 1–50, default 20 |
| `offset` | number | Pagination offset |
| `sort` | string | `asc` or `desc` |
| `trustedOnly` | boolean | Filter to verified/trusted tokens |

**Response:** `{ tokens: Token[], total: number }`

---

## Authenticated REST API (requires `x-api-key`)

Access is granted case-by-case. Request via clanker.world/contact-us.
Pass your key as a request header: `x-api-key: YOUR_KEY`

### Get token by contract address

```
GET /get-clanker-by-address?address=0x...
```

Returns full token metadata including `deploy_config`, `social_context`,
`pool_config`, `warnings`, `msg_sender`, `factory_address`.

---

### Deploy a new token

```
POST /tokens/deploy
Content-Type: application/json
x-api-key: YOUR_KEY
```

**Minimal required body:**
```json
{
  "token": {
    "name": "My Token",
    "symbol": "MYT",
    "tokenAdmin": "0xYOUR_WALLET",
    "requestKey": "unique-32-char-string-goes-here!!"
  },
  "rewards": [
    {
      "admin": "0xYOUR_WALLET",
      "recipient": "0xYOUR_WALLET",
      "allocation": 100,
      "rewardsToken": "Both"
    }
  ]
}
```

**Full optional parameters:**
```json
{
  "token": {
    "name": "string",
    "symbol": "string (3-5 chars)",
    "tokenAdmin": "0x...",
    "requestKey": "unique-32-char-id",
    "image": "https://...",
    "description": "string",
    "socialMediaUrls": [{ "platform": "twitter", "url": "https://..." }],
    "auditUrls": ["https://..."]
  },
  "rewards": [
    {
      "admin": "0x...",
      "recipient": "0x...",
      "allocation": 100,
      "rewardsToken": "Both"
    }
  ],
  "pool": {
    "type": "standard",
    "pairedToken": "0xWETH_ADDRESS",
    "initialMarketCap": 10000
  },
  "fees": {
    "type": "static",
    "clankerFee": 100,
    "pairedFee": 100
  },
  "vault": {
    "percentage": 10,
    "lockupDuration": 7,
    "vestingDuration": 30
  },
  "airdrop": {
    "entries": [{ "account": "0x...", "amount": "1000000000000000000" }],
    "lockupDuration": 1,
    "vestingDuration": 0
  },
  "chainId": 8453
}
```

**Constraints:**
- `rewards` allocations must sum to 100%, max 7 recipients
- `vault.lockupDuration` minimum 7 days
- `airdrop.lockupDuration` minimum 1 day
- Total supply across all extensions max 90%

**Success response:**
```json
{
  "success": true,
  "message": "Token deployment enqueued. Expected address: 0x...",
  "expectedAddress": "0x..."
}
```

**Error response:**
```json
{
  "error": "Invalid input. See data for details.",
  "data": [{ "code": "validation_error", "path": ["field"], "message": "..." }]
}
```

---

## SDK — `clanker-sdk` (server-side deployment)

Use this when you need programmatic token deployment from a server with a private key.
For searching/reading tokens, use the REST API above.

### Install

```bash
npm install clanker-sdk viem
```

### Initialize

```typescript
import { Clanker } from 'clanker-sdk/v4';
import {
  createWalletClient,
  createPublicClient,
  http,
  privateKeyToAccount
} from 'viem';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http()
});

const clanker = new Clanker({ wallet: walletClient, publicClient });
```

### Deploy a token

```typescript
const { txHash, waitForTransaction, error } = await clanker.deploy({
  name: 'My Token',
  symbol: 'MYT',
  tokenAdmin: account.address,
  // Optional:
  image: 'https://...',
  context: {
    interface: 'my-snap',
    platform: 'farcaster',
    messageId: castHash,
    id: String(fid)
  },
  fees: FEE_CONFIGS.StaticBasic,        // or DynamicBasic, Dynamic3
  positions: POOL_POSITIONS.Standard,    // or Project, TwentyETH
  rewards: [
    {
      recipient: account.address,
      admin: account.address,
      bps: 10000,    // 100% in basis points
      token: 'Both'
    }
  ],
  // Optional vault (lock % of supply)
  vault: {
    percentage: 10,
    lockupDuration: 7 * 24 * 60 * 60,   // seconds (min 7 days)
    vestingDuration: 30 * 24 * 60 * 60
  }
});

if (error) throw new Error(`Deploy failed: ${error}`);

const { address } = await waitForTransaction();
console.log('Token deployed at:', address);
```

### Post-deployment operations

```typescript
// Claim LP fee rewards
const { txHash, error } = await clanker.claimRewards({
  tokenAddress: '0x...',
  recipient: account.address
});

// Check pending rewards
const available = await clanker.availableRewards({ tokenAddress: '0x...' });

// Claim vested tokens
await clanker.claimVaultedTokens({ tokenAddress: '0x...' });

// Update metadata
await clanker.updateImage({ tokenAddress: '0x...', image: 'https://...' });
await clanker.updateMetadata({ tokenAddress: '0x...', description: 'New desc' });

// Reward management
await clanker.updateRewardRecipient({
  tokenAddress: '0x...',
  newRecipient: '0x...'
});
```

**All SDK methods return `{ txHash?, error?, waitForTransaction? }` — always check `error` before proceeding.**

---

## Using Clanker in a Farcaster Snap

### Tip flow pattern

In a snap, never execute token transfers directly — use the `send_token` action
which delegates to the user's wallet:

```typescript
// In your snap response:
{
  action: 'send_token',
  data: {
    token: {
      caip19: `eip155:8453/erc20:${tokenContractAddress}`  // Base chain ERC-20
    },
    recipientFid: recipientFid,    // Farcaster FID (wallet resolved by client)
    // OR:
    recipientAddress: '0x...',     // direct address
    amount: userAmount              // token amount (in token units, not wei)
  }
}
```

### Search tokens in a snap handler

```typescript
const res = await fetch(
  `https://www.clanker.world/api/tokens?q=${encodeURIComponent(query)}&limit=10&includeMarket=true`,
  { headers: { 'Accept': 'application/json' } }
);
const { tokens } = await res.json();
```

### Token deployment from a snap (v0.2+)

Requires:
1. A Clanker API key (`x-api-key`) stored as an env var
2. Or a server-side private key + `clanker-sdk` (server wallet pays gas)

For user-initiated deployment in a snap, prefer the REST API (`POST /tokens/deploy`)
so the server handles signing without exposing user private keys.

---

## Supported Chains

| Chain | Chain ID | Notes |
|---|---|---|
| Base | 8453 | Primary — all features |
| Arbitrum | 42161 | Full support |
| Unichain | 130 | Full support |
| BSC | 56 | Full support |
| Ethereum | 1 | Full support |
| Base Sepolia | 84532 | Testnet |
| Monad | — | Static fees only |
| Abstract | — | Full support |

## CAIP-19 Format for Base ERC-20 Tokens

```
eip155:8453/erc20:0xTOKEN_CONTRACT_ADDRESS
```

Use this format when passing tokens to Farcaster snap `send_token` / `view_token` actions.
