'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { createStorage, http, fallback } from 'wagmi';

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '3b2df2ae3d12134e87cf4397c8657e7a';
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Use environment variable or fallback to production URL
// This ensures consistency between SSR and client-side
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dexmail.app';

// Multiple RPC endpoints for Base mainnet with fallback support
const baseRpcUrls = [
  // Primary: Alchemy (if API key available)
  ...(alchemyApiKey ? [`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`] : []),
  // Official Base RPC
  'https://mainnet.base.org',
  // Ankr public RPC
  'https://rpc.ankr.com/base',
  // PublicNode
  'https://base.publicnode.com',
  // 1RPC
  'https://1rpc.io/base',
  // Blast API public
  'https://base.blastapi.io/17f1a5bb-6ee6-40f2-bba1-03a91d8e3ad8',
  // Blockpi
  'https://base.blockpi.network/v1/rpc/public',
];

export const wagmiConfig = getDefaultConfig({
  appName: 'DexMail',
  projectId,
  chains: [base],
  transports: {
    [base.id]: fallback(
      baseRpcUrls.map(url => http(url, {
        timeout: 10_000,
        retryCount: 2,
        retryDelay: 1000,
      }))
    ),
  },
  appUrl,
  appIcon: "/favicon.ico",
  appDescription: "DexMail - Decentralized Email on Base",
  ssr: true,
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
});

export default wagmiConfig;
