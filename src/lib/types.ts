// API Types for DexMail backend integration

export interface User {
  email: string;
  authType: 'wallet' | 'coinbase-embedded';
  walletAddress?: string;
  emailVerified?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CryptoAsset {
  type: 'erc20' | 'nft' | 'eth';
  token?: string;
  amount?: string;
  symbol?: string;
  tokenId?: string;
}

export interface EmailMessage {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  body?: string;
  timestamp: string;
  hasCryptoTransfer?: boolean;
  ipfsCid?: string;
  encryptionKey?: string;
  content?: {
    from: string;
    to: string[];
    subject: string;
    body: string;
    timestamp: string;
  };
  inReplyTo?: string;
}

export interface CryptoTransfer {
  emailHash: string;
  recipientEmail: string;
  senderEmail: string;
  walletAddress: string;
  transfers: CryptoAsset[];
  status: 'pending' | 'claimed' | 'expired';
  claimToken: string;
  expiresAt: string;
  claimedAt?: string;
}

export interface ClaimStatus {
  token: string;
  status: 'pending' | 'claimed' | 'expired' | 'invalid';
  email: string;
  walletAddress: string;
  assets: CryptoAsset[];
  expiresAt: string;
  claimedAt?: string;
  isExpired: boolean;
}

export interface WalletInfo {
  email: string;
  walletAddress: string;
  isDeployed: boolean;
  owner: string | null;
  computedAddress: string;
}

// NFT Types
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface NFTInfo {
  contractAddress: string;
  tokenId: string;
  metadata: NFTMetadata;
  owner: string;
  tokenURI: string;
}

export interface NFTTransfer {
  recipientEmail: string;
  contractAddress: string;
  tokenId: string;
}

export interface NFTBatchResponse {
  success: boolean;
  results: Array<{
    recipientEmail: string;
    success: boolean;
    transactionHash?: string;
    error?: string;
  }>;
  successCount: number;
  totalCount: number;
}

// Wallet Management Types
export interface SponsoredTransactionData {
  recipientEmail: string;
  token: string;
  amount: string;
  isNFT: boolean;
}

export interface SponsoredTransactionResponse {
  success: boolean;
  userOperationHash: string;
  recipientEmail: string;
  token: string;
  amount: string;
}

export interface BatchDeploymentData {
  email: string;
  ownerAddress: string;
  useGasSponsoring?: boolean;
}

export interface BatchDeploymentResponse {
  success: boolean;
  deployments: Array<{
    email: string;
    ownerAddress: string;
    result: {
      success: boolean;
      walletAddress?: string;
      transactionHash?: string;
      error?: string;
    };
  }>;
  successCount: number;
  totalCount: number;
}

// Blockchain Transfer Types
export interface BlockchainTransfer {
  token: string;
  amount: string;
  isNFT: boolean;
  sender: string;
  recipientEmail: string;
  timestamp: string;
  claimed: boolean;
}

export interface BlockchainTransfersResponse {
  email: string;
  transfers: BlockchainTransfer[];
}

// NFT Approval Types
export interface NFTApprovalData {
  contractAddress: string;
  tokenId: string;
  spender: string;
  useGasSponsoring?: boolean;
}

export interface NFTApprovalAllData {
  contractAddress: string;
  operator: string;
  approved: boolean;
  useGasSponsoring?: boolean;
}

export interface NFTApprovalResponse {
  success: boolean;
  transactionHash: string;
  contractAddress: string;
  tokenId?: string;
  spender?: string;
  operator?: string;
  approved?: boolean;
}

// Enhanced Wallet Info
export interface EnhancedWalletInfo extends WalletInfo {
  owner: string | null;
  computedAddress: string;
}

export interface ApiError {
  error: string;
}

export interface ClaimVerificationResponse {
  valid: boolean;
  email: string;
  assets: CryptoAsset[];
  walletAddress: string;
  transactionHash?: string;
}

export interface ClaimDeploymentData {
  token: string;
  ownerAddress: string;
  useGasSponsoring?: boolean;
}

export interface ClaimDeploymentResponse {
  success: boolean;
  walletAddress: string;
  assets: CryptoAsset[];
  transactionHash: string;
  gasSponsored?: boolean;
}

export interface ClaimSummary {
  totalAssets: number;
  totalValueUSD?: number;
  hasERC20: boolean;
  hasNFT: boolean;
  hasETH: boolean;
  expiresIn: number;
}
