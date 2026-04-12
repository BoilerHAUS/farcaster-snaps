// Raw Hub v1 API response shapes — internal to this package.

export type HubUserDataType =
  | "USER_DATA_TYPE_PFP"
  | "USER_DATA_TYPE_DISPLAY"
  | "USER_DATA_TYPE_BIO"
  | "USER_DATA_TYPE_USERNAME"
  | "USER_DATA_TYPE_URL"
  | "USER_DATA_TYPE_LOCATION"
  | "USER_DATA_TYPE_BANNER"
  | "USER_DATA_PRIMARY_ADDRESS_ETHEREUM"
  | "USER_DATA_PRIMARY_ADDRESS_SOLANA"
  | string;

export type HubUserDataBody = {
  type: HubUserDataType;
  value: string;
};

export type HubVerificationBody = {
  address: string;
  claimSignature: string;
  blockHash: string;
  type: number;
  chainId: number;
  protocol: "PROTOCOL_ETHEREUM" | "PROTOCOL_SOLANA" | string;
};

export type HubCastEmbed = {
  url?: string;
  castId?: { fid: number; hash: string };
};

export type HubCastAddBody = {
  embedsDeprecated: string[];
  mentions: number[];
  parentCastId: { fid: number; hash: string } | null;
  parentUrl: string | null;
  text: string;
  embeds: HubCastEmbed[];
  mentionsPositions: number[];
  type: string;
};

export type HubMessageData = {
  type: string;
  fid: number;
  timestamp: number;
  network: string;
  userDataBody?: HubUserDataBody;
  verificationAddAddressBody?: HubVerificationBody;
  castAddBody?: HubCastAddBody;
};

export type HubMessage = {
  data: HubMessageData;
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
};

export type HubMessagesResponse = {
  messages: HubMessage[];
  nextPageToken: string;
};
