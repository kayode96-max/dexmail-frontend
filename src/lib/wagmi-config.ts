'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { createStorage, http } from 'wagmi';

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '3b2df2ae3d12134e87cf4397c8657e7a';
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

export const wagmiConfig = getDefaultConfig({
  appName: 'DexMail',
  projectId,
  chains: [base],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
  },
  appUrl: typeof window !== 'undefined' ? window.location.origin : (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://dexmail.app'),
  appIcon: "/favicon.ico",
  appDescription: "DexMail - Decentralized Email on Base",
  ssr: true,
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
});

export default wagmiConfig;
