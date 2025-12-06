import { authService } from './auth-service';
import { mailService } from './mail-service';
import { cryptoService } from './crypto-service';
import { nftService } from './nft-service';
import { walletService } from './wallet-service';
import { claimService } from './claim-service';
import { 
  CryptoAsset, 
  EmailMessage, 
  CryptoTransfer, 
  NFTTransfer,
  User 
} from './types';

export interface SendEmailWithCryptoData {
  from: string;
  to: string[];
  subject: string;
  body: string;
  assets: CryptoAsset[];
}

export interface SendEmailWithNFTData {
  from: string;
  to: string[];
  subject: string;
  body: string;
  nfts: NFTTransfer[];
}

export interface OnboardUserData {
  email: string;
  password?: string;
  walletAddress?: string;
  authType: 'traditional' | 'wallet';
}

export interface ClaimAssetsData {
  claimToken: string;
  ownerAddress: string;
  useGasSponsoring?: boolean;
}

class IntegrationService {
  /**
   * Complete email with crypto transfer workflow
   */
  async sendEmailWithCrypto(data: SendEmailWithCryptoData): Promise<{
    messageId: string;
    claimToken?: string;
    walletAddresses: Record<string, string>;
  }> {
    // First, get wallet addresses for all recipients
    const walletAddresses: Record<string, string> = {};
    for (const recipient of data.to) {
      try {
        const walletInfo = await cryptoService.getWalletQuote(recipient);
        walletAddresses[recipient] = walletInfo.walletAddress;
      } catch (error) {
        console.warn(`Failed to get wallet for ${recipient}:`, error);
      }
    }

    // Send email with crypto transfer
    const emailResponse = await mailService.sendEmail({
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body,
      cryptoTransfer: {
        enabled: true,
        assets: data.assets
      }
    });

    // Send crypto assets if there's only one recipient
    let claimToken: string | undefined;
    if (data.to.length === 1) {
      try {
        const cryptoResponse = await cryptoService.sendCrypto({
          recipientEmail: data.to[0],
          senderEmail: data.from,
          assets: data.assets
        });
        claimToken = cryptoResponse.claimToken;
      } catch (error) {
        console.warn('Failed to send crypto:', error);
      }
    }

    return {
      messageId: emailResponse.messageId,
      claimToken,
      walletAddresses
    };
  }

  /**
   * Complete email with NFT transfer workflow
   */
  async sendEmailWithNFTs(data: SendEmailWithNFTData, senderKey: string): Promise<{
    messageId: string;
    nftResults: Array<{
      recipientEmail: string;
      success: boolean;
      transactionHash?: string;
      error?: string;
    }>;
  }> {
    // Send email first
    const emailResponse = await mailService.sendEmail({
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body
    });

    // Send NFTs to each recipient
    const nftResults: Array<{
      recipientEmail: string;
      success: boolean;
      transactionHash?: string;
      error?: string;
    }> = [];

    for (const nft of data.nfts) {
      try {
        const nftResponse = await (nftService as any).sendNFT(
          { ...nft, useGasSponsoring: true },
          senderKey
        );
        nftResults.push({
          recipientEmail: nft.recipientEmail,
          success: true,
          transactionHash: nftResponse.transactionHash
        });
      } catch (error) {
        nftResults.push({
          recipientEmail: nft.recipientEmail,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      messageId: emailResponse.messageId,
      nftResults
    };
  }

  /**
   * Complete user onboarding workflow
   */
  async onboardUser(data: OnboardUserData): Promise<{
    user: User;
    walletDeployed: boolean;
    walletAddress?: string;
  }> {
    // Register user
    const authResponse = await authService.register({
      email: data.email,
      password: data.password || '',
      authType: data.authType,
      walletAddress: data.walletAddress
    });

    let walletDeployed = false;
    let walletAddress: string | undefined;

    // Deploy wallet if user provided wallet address
    if (data.walletAddress) {
      try {
        const deployResponse = await walletService.deployWallet({
          email: data.email,
          ownerAddress: data.walletAddress,
          useGasSponsoring: true
        });
        walletDeployed = deployResponse.success;
        walletAddress = deployResponse.walletAddress;
      } catch (error) {
        console.warn('Failed to deploy wallet during onboarding:', error);
        // Try to get the computed address even if deployment failed
        try {
          const walletInfo = await walletService.getWalletInfo(data.email);
          walletAddress = walletInfo.computedAddress;
        } catch (walletInfoError) {
          console.warn('Failed to get wallet info:', walletInfoError);
        }
      }
    }

    return {
      user: authResponse.user,
      walletDeployed,
      walletAddress
    };
  }

  /**
   * Complete claim assets workflow
   */
  async claimAssets(data: ClaimAssetsData): Promise<{
    success: boolean;
    walletAddress: string;
    assets: CryptoAsset[];
    transactionHash: string;
    gasSponsored: boolean;
  }> {
    // Verify claim token first
    const verification = await claimService.verifyClaimToken(data.claimToken);
    if (!verification.valid) {
      throw new Error('Invalid claim token');
    }

    // Deploy wallet and claim assets
    const claimResponse = await claimService.deployAndClaim({
      token: data.claimToken,
      ownerAddress: data.ownerAddress,
      useGasSponsoring: data.useGasSponsoring ?? true
    });

    return {
      success: claimResponse.success,
      walletAddress: claimResponse.walletAddress,
      assets: claimResponse.assets,
      transactionHash: claimResponse.transactionHash,
      gasSponsored: claimResponse.gasSponsored ?? false
    };
  }

  /**
   * Get user's complete portfolio
   */
  async getUserPortfolio(email: string): Promise<{
    pendingClaims: CryptoTransfer[];
    blockchainTransfers: Array<{
      token: string;
      amount: string;
      isNFT: boolean;
      sender: string;
      recipientEmail: string;
      timestamp: string;
      claimed: boolean;
    }>;
    walletInfo: {
      isDeployed: boolean;
      walletAddress: string;
      owner: string | null;
    };
    emails: {
      inbox: EmailMessage[];
      sent: EmailMessage[];
    };
  }> {
    const [pendingClaims, blockchainTransfers, walletInfo, inbox, sent] = await Promise.allSettled([
      cryptoService.getPendingTransfers(email),
      cryptoService.getPendingBlockchainTransfers(email),
      walletService.getWalletInfo(email),
      mailService.getInbox(email),
      mailService.getSent(email)
    ]);

    return {
      pendingClaims: pendingClaims.status === 'fulfilled' ? pendingClaims.value : [],
      blockchainTransfers: blockchainTransfers.status === 'fulfilled' ? blockchainTransfers.value.transfers : [],
      walletInfo: walletInfo.status === 'fulfilled' ? {
        isDeployed: walletInfo.value.isDeployed,
        walletAddress: walletInfo.value.walletAddress,
        owner: walletInfo.value.owner
      } : {
        isDeployed: false,
        walletAddress: '',
        owner: null
      },
      emails: {
        inbox: inbox.status === 'fulfilled' ? inbox.value : [],
        sent: sent.status === 'fulfilled' ? sent.value : []
      }
    };
  }

  /**
   * Setup user wallet with email integration
   */
  async setupUserWallet(email: string, ownerAddress: string): Promise<{
    deployed: boolean;
    walletAddress: string;
    gasSponsored: boolean;
    transactionHash?: string;
  }> {
    try {
      const deployResponse = await walletService.deployWalletWithAutoSponsoring(email, ownerAddress);
      return {
        deployed: deployResponse.success,
        walletAddress: deployResponse.walletAddress,
        gasSponsored: deployResponse.gasSponsored ?? false,
        transactionHash: deployResponse.transactionHash
      };
    } catch (error) {
      // If deployment fails, still return the computed address
      const walletInfo = await walletService.getWalletInfo(email);
      return {
        deployed: false,
        walletAddress: walletInfo.computedAddress,
        gasSponsored: false
      };
    }
  }

  /**
   * Validate email and crypto data before sending
   */
  validateEmailWithCryptoData(data: SendEmailWithCryptoData): string[] {
    const errors: string[] = [];

    if (!data.from || !walletService.isValidEmail(data.from)) {
      errors.push('Invalid sender email');
    }

    if (!data.to || data.to.length === 0) {
      errors.push('At least one recipient required');
    }

    data.to.forEach((email, index) => {
      if (!walletService.isValidEmail(email)) {
        errors.push(`Invalid recipient email at index ${index}`);
      }
    });

    if (!data.subject || data.subject.trim().length === 0) {
      errors.push('Email subject required');
    }

    if (!data.body || data.body.trim().length === 0) {
      errors.push('Email body required');
    }

    if (!data.assets || data.assets.length === 0) {
      errors.push('At least one crypto asset required');
    }

    data.assets.forEach((asset, index) => {
      if (!asset.type || !['erc20', 'nft', 'eth'].includes(asset.type)) {
        errors.push(`Invalid asset type at index ${index}`);
      }
      
      if (asset.type === 'erc20' && (!asset.amount || !asset.symbol)) {
        errors.push(`ERC20 asset at index ${index} missing amount or symbol`);
      }
      
      if (asset.type === 'nft' && (!asset.token || !asset.tokenId)) {
        errors.push(`NFT asset at index ${index} missing contract address or token ID`);
      }
      
      if (asset.type === 'eth' && !asset.amount) {
        errors.push(`ETH asset at index ${index} missing amount`);
      }
    });

    return errors;
  }
}

export const integrationService = new IntegrationService();
export default IntegrationService;