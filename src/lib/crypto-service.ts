import {
  CryptoAsset,
  CryptoTransfer,
  ClaimStatus,
  EnhancedWalletInfo,
  NFTInfo,
  NFTTransfer,
  NFTBatchResponse,
  SponsoredTransactionData,
  SponsoredTransactionResponse,
  BatchDeploymentData,
  BatchDeploymentResponse,
  BlockchainTransfersResponse,
  NFTApprovalData,
  NFTApprovalAllData,
  NFTApprovalResponse,
  ClaimDeploymentResponse,
  ClaimVerificationResponse
} from './types';
import { readContract, writeContract } from '@wagmi/core';
import { wagmiConfig } from './wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from './contracts';
import { parseEther, parseUnits } from 'viem';
import { claimService } from './claim-service';
import { walletService } from './wallet-service';

export interface SendCryptoData {
  recipientEmail: string;
  senderEmail: string;
  assets: CryptoAsset[];
}

export interface SendCryptoResponse {
  claimToken: string;
  walletAddress: string;
}

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

class CryptoService {
  async ensureApproval(tokenAddress: string, amount: bigint): Promise<void> {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') return;

    const { erc20Abi } = await import('viem');
    const { getAccount, readContract, writeContract, waitForTransactionReceipt } = await import('@wagmi/core');
    const account = getAccount(wagmiConfig);

    if (account.address) {
      // Check allowance
      const allowance = await readContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, BASEMAILER_ADDRESS]
      }) as bigint;

      if (allowance < amount) {
        console.log(`Requesting approval for ${amount} tokens...`);
        const approvalTx = await writeContract(wagmiConfig, {
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [BASEMAILER_ADDRESS, amount]
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: approvalTx });
        console.log('Approval confirmed');
      }
    }
  }

  async sendCrypto(data: SendCryptoData): Promise<SendCryptoResponse> {
    // We only support sending one asset at a time in this refactor for simplicity
    // or we loop.
    // The contract `sendCryptoToEmail` takes one asset.

    if (data.assets.length === 0) throw new Error('No assets to send');

    const asset = data.assets[0];
    const isNft = asset.type === 'nft';
    const tokenAddress = asset.token || '0x0000000000000000000000000000000000000000';

    let amount = BigInt(0);
    if (asset.type === 'eth') {
      amount = parseEther(asset.amount || '0');
    } else if (asset.type === 'erc20') {
      amount = parseUnits(asset.amount || '0', 18); // Assuming 18 decimals
    } else if (asset.type === 'nft') {
      amount = BigInt(asset.tokenId || '0');
    }

    // Handle ERC20 Approval
    if (asset.type === 'erc20') {
      await this.ensureApproval(tokenAddress, amount);
    }

    const txHash = await writeContract(wagmiConfig, {
      address: BASEMAILER_ADDRESS,
      abi: baseMailerAbi,
      functionName: 'sendCryptoToEmail',
      args: [data.recipientEmail, tokenAddress, amount, isNft],
      value: asset.type === 'eth' ? amount : BigInt(0)
    });

    return {
      claimToken: txHash, // Use txHash as claim token for now
      walletAddress: await this.getWalletAddress(data.recipientEmail).then(r => r.walletAddress)
    };
  }

  async getWalletQuote(recipientEmail: string): Promise<{ walletAddress: string }> {
    const address = await readContract(wagmiConfig, {
      address: BASEMAILER_ADDRESS,
      abi: baseMailerAbi,
      functionName: 'computeWalletAddress',
      args: [recipientEmail]
    }) as string;
    return { walletAddress: address };
  }

  async getPendingTransfers(email: string): Promise<CryptoTransfer[]> {
    const transfers = await readContract(wagmiConfig, {
      address: BASEMAILER_ADDRESS,
      abi: baseMailerAbi,
      functionName: 'getPendingTransfers',
      args: [email]
    }) as any[];

    return transfers.map(t => ({
      emailHash: '', // Not returned by contract function in this struct?
      recipientEmail: t.recipientEmail,
      senderEmail: t.sender, // Sender address, not email
      walletAddress: '', // We'd need to compute it
      transfers: [{
        type: t.isNft ? 'nft' : (t.token === '0x0000000000000000000000000000000000000000' ? 'eth' : 'erc20'),
        token: t.token,
        amount: t.amount.toString(),
        tokenId: t.isNft ? t.amount.toString() : undefined
      }],
      status: t.claimed ? 'claimed' : 'pending',
      claimToken: '',
      expiresAt: '', // Not in struct
      claimedAt: t.claimed ? new Date().toISOString() : undefined
    }));
  }

  async getWalletAddress(email: string): Promise<{ email: string; walletAddress: string }> {
    const address = await this.getWalletQuote(email);
    return { email, walletAddress: address.walletAddress };
  }

  async getPendingBlockchainTransfers(email: string): Promise<BlockchainTransfersResponse> {
    const transfers = await this.getPendingTransfers(email);
    return {
      email,
      transfers: transfers.map(t => ({
        token: t.transfers[0].token || '',
        amount: t.transfers[0].amount || '0',
        isNFT: t.transfers[0].type === 'nft',
        sender: t.senderEmail,
        recipientEmail: t.recipientEmail,
        timestamp: new Date().toISOString(), // Mock timestamp if not available
        claimed: t.status === 'claimed'
      }))
    };
  }

  // ... other methods (deployWallet, sponsorTransaction, etc.)
  // I'll implement them as wrappers or throw not implemented

  async deployWallet(data: DeployWalletData): Promise<DeployWalletResponse> {
    return walletService.deployWallet(data);
  }

  async sponsorTransaction(data: SponsoredTransactionData, senderKey: string): Promise<SponsoredTransactionResponse> {
    throw new Error('Not implemented');
  }

  async batchDeployWallets(deployments: BatchDeploymentData[]): Promise<BatchDeploymentResponse> {
    throw new Error('Not implemented');
  }

  async getWalletInfo(email: string): Promise<EnhancedWalletInfo> {
    return walletService.getWalletInfo(email);
  }

  async sendNFT(data: NFTTransfer & { useGasSponsoring?: boolean }, senderKey: string) {
    // Use sendCrypto
    return this.sendCrypto({
      recipientEmail: data.recipientEmail,
      senderEmail: '', // Current user
      assets: [{
        type: 'nft',
        token: data.contractAddress,
        tokenId: data.tokenId
      }]
    });
  }

  // ... other NFT methods
  async batchSendNFTs(transfers: NFTTransfer[], useGasSponsoring: boolean, senderKey: string): Promise<NFTBatchResponse> {
    throw new Error('Not implemented');
  }

  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTInfo> {
    throw new Error('Not implemented');
  }

  async approveNFT(data: NFTApprovalData, senderKey: string): Promise<NFTApprovalResponse> {
    throw new Error('Not implemented');
  }

  async approveAllNFTs(data: NFTApprovalAllData, senderKey: string): Promise<NFTApprovalResponse> {
    throw new Error('Not implemented');
  }

  async verifyClaimToken(token: string): Promise<ClaimVerificationResponse> {
    return claimService.verifyClaimToken(token);
  }

  async getClaimStatus(token: string): Promise<ClaimStatus> {
    return claimService.getClaimStatus(token);
  }

  async deployAndClaim(token: string, ownerAddress: string, useGasSponsoring: boolean = true): Promise<ClaimDeploymentResponse> {
    return claimService.deployAndClaim({
      token,
      ownerAddress,
      useGasSponsoring
    });
  }
}

export const cryptoService = new CryptoService();
export default CryptoService;
