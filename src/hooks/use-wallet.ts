'use client';

import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { useCallback, useState } from 'react';
import { authService } from '@/lib/auth-service';

import { SiweMessage } from 'siwe';

export function useWallet() {
  const { address, isConnected, status, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const connectWallet = useCallback(async () => {
    try {
      // Try to find Coinbase Wallet connector first
      const coinbaseConnector = connectors.find(
        (connector) => connector.name.toLowerCase().includes('coinbase')
      );

      if (coinbaseConnector) {
        await new Promise((resolve, reject) => {
          connect({ connector: coinbaseConnector }, {
            onSuccess: resolve,
            onError: reject,
          });
        });
      } else if (connectors.length > 0) {
        // Fallback to first available connector
        await new Promise((resolve, reject) => {
          connect({ connector: connectors[0] }, {
            onSuccess: resolve,
            onError: reject,
          });
        });
      } else {
        throw new Error('No wallet connectors available');
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }, [connect, connectors]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    return await signMessageAsync({ message });
  }, [signMessageAsync]);

  const authenticateWithWallet = useCallback(async (email: string) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsAuthenticating(true);
    try {
      // Get challenge from backend
      const challenge = await authService.getChallenge(email);

      // Create SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const message = new SiweMessage({
        domain,
        address,
        statement: 'Sign in to DexMail to access your decentralized inbox.',
        uri: origin,
        version: '1',
        chainId: chain?.id || 8453,
        nonce: challenge.nonce,
      });

      const preparedMessage = message.prepareMessage();
      const signature = await signMessage(preparedMessage);

      const authResponse = await authService.loginWithWallet(email, address, preparedMessage, signature);

      return authResponse;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, chain?.id, signMessage]);

  const registerWithWallet = useCallback(async (email: string) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsAuthenticating(true);
    try {
      // Get challenge and sign it
      const challenge = await authService.getChallenge(email);

      // Create SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const message = new SiweMessage({
        domain,
        address,
        statement: 'Sign in to DexMail to access your decentralized inbox.',
        uri: origin,
        version: '1',
        chainId: chain?.id || 8453,
        nonce: challenge.nonce,
      });

      const preparedMessage = message.prepareMessage();
      const signature = await signMessage(preparedMessage);

      // Register with wallet
      const authResponse = await authService.register({
        email,
        authType: 'wallet',
        walletAddress: address,
        signature,
        message: preparedMessage,
      });

      return authResponse;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, chain?.id, signMessage]);

  return {
    address,
    isConnected,
    isConnecting,
    isSigning,
    isAuthenticating,
    status,
    connectWallet,
    disconnect,
    signMessage,
    authenticateWithWallet,
    registerWithWallet,
  };
}
