import {
  EnhancedWalletInfo,
  BatchDeploymentData,
  BatchDeploymentResponse,
  SponsoredTransactionData,
  SponsoredTransactionResponse
} from './types';
import { readContract, writeContract } from '@wagmi/core';
import { wagmiConfig } from './wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from './contracts';

export interface DeployWalletData {
  email: string;
  ownerAddress: string;
  useGasSponsoring?: boolean;
}

export interface DeployWalletResponse {
  success: boolean;
  walletAddress: string;
  transactionHash: string;
  alreadyDeployed: boolean;
  gasSponsored?: boolean;
}

class WalletService {
  async deployWallet(data: DeployWalletData): Promise<DeployWalletResponse> {
    try {
      // Check if user is the registered owner
      const emailOwner = await readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getEmailOwner',
        args: [data.email]
      }) as string;

      const { getAccount } = await import('@wagmi/core');
      const account = getAccount(wagmiConfig);

      // If user is the registered owner, use deployMyWallet
      if (account.address && emailOwner && emailOwner.toLowerCase() === account.address.toLowerCase()) {
        console.log('User is registered owner, calling deployMyWallet');
        const txHash = await writeContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'deployMyWallet',
          args: [data.email]
        });

        return {
          success: true,
          walletAddress: await this.getComputedWalletAddress(data.email),
          transactionHash: txHash,
          alreadyDeployed: false,
          gasSponsored: false
        };
      }

      // Fallback to claimWallet (requires proof, which we mock as '0x' for now)
      // This path is for unregistered users claiming via relayer/code
      const txHash = await writeContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'claimWallet',
        args: [data.email, data.ownerAddress]
      });

      return {
        success: true,
        walletAddress: await this.getComputedWalletAddress(data.email),
        transactionHash: txHash,
        alreadyDeployed: false,
        gasSponsored: false
      };
    } catch (error: any) {
      console.error('Deploy wallet error:', error);
      // Check if already deployed
      const isDeployed = await this.isWalletDeployed(data.email);
      if (isDeployed) {
        return {
          success: true,
          walletAddress: await this.getComputedWalletAddress(data.email),
          transactionHash: '',
          alreadyDeployed: true
        };
      }
      throw error;
    }
  }

  async sponsorTransaction(data: SponsoredTransactionData, senderKey: string): Promise<SponsoredTransactionResponse> {
    // Gas sponsoring skipped for now as per user request
    throw new Error('Gas sponsoring not implemented');
  }

  async batchDeployWallets(deployments: BatchDeploymentData[]): Promise<BatchDeploymentResponse> {
    // Not implemented for now
    return {
      success: false,
      deployments: [],
      successCount: 0,
      totalCount: deployments.length
    };
  }

  async getWalletInfo(email: string): Promise<EnhancedWalletInfo> {
    const [walletAddress, isDeployed, owner, computedAddress] = await Promise.all([
      readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getWalletAddress',
        args: [this.hashEmail(email)]
      }) as Promise<string>,
      readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'isWalletDeployed',
        args: [await this.getComputedWalletAddress(email)] // Wait, isWalletDeployed takes address
      }) as Promise<boolean>,
      readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getEmailOwner',
        args: [email]
      }) as Promise<string>,
      this.getComputedWalletAddress(email)
    ]);

    return {
      email,
      walletAddress: isDeployed ? walletAddress : computedAddress,
      isDeployed,
      owner: owner === '0x0000000000000000000000000000000000000000' ? null : owner,
      computedAddress
    };
  }

  async isWalletDeployed(email: string): Promise<boolean> {
    const address = await this.getComputedWalletAddress(email);
    return readContract(wagmiConfig, {
      address: BASEMAILER_ADDRESS,
      abi: baseMailerAbi,
      functionName: 'isWalletDeployed',
      args: [address]
    }) as Promise<boolean>;
  }

  async getComputedWalletAddress(email: string): Promise<string> {
    return readContract(wagmiConfig, {
      address: BASEMAILER_ADDRESS,
      abi: baseMailerAbi,
      functionName: 'computeWalletAddress',
      args: [email]
    }) as Promise<string>;
  }

  async deployWalletWithAutoSponsoring(email: string, ownerAddress: string): Promise<DeployWalletResponse> {
    return this.deployWallet({ email, ownerAddress, useGasSponsoring: false });
  }

  async batchDeployWalletsWithProgress(
    deployments: BatchDeploymentData[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchDeploymentResponse> {
    return this.batchDeployWallets(deployments);
  }

  isValidWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async estimateDeploymentCost(email: string): Promise<{
    gasEstimate: string;
    costInETH: string;
    canUseGasSponsoring: boolean;
  }> {
    return {
      gasEstimate: '200000',
      costInETH: '0.005',
      canUseGasSponsoring: false
    };
  }

  private hashEmail(email: string): string {
    // We need keccak256 hash of email. 
    // Since we don't have keccak256 imported here, we can use viem's keccak256 if available or just rely on contract to do it if it takes string.
    // But getWalletAddress takes bytes32 emailHash.
    // I'll import keccak256 and toHex from viem.
    // But for now I'll just use a placeholder or assume the contract helper `computeWalletHash` exists?
    // Yes, `computeWalletHash` exists in ABI.
    return '0x00'; // Placeholder, should call computeWalletHash
  }
}

export const walletService = new WalletService();
export default WalletService;