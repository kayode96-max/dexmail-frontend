import {
  ClaimStatus,
  CryptoAsset,
  ClaimVerificationResponse,
  ClaimDeploymentData,
  ClaimDeploymentResponse,
  ClaimSummary
} from './types';
import { walletService } from './wallet-service';

class ClaimService {
  async verifyClaimToken(token: string): Promise<ClaimVerificationResponse> {
    const { validateClaimCode } = await import('./claim-code');
    const validation = validateClaimCode(token);

    if (!validation.valid || !validation.data) {
      return {
        valid: false,
        email: '',
        assets: [],
        walletAddress: ''
      };
    }

    const claimData = validation.data;

    return {
      valid: true,
      email: claimData.recipientEmail,
      assets: claimData.assets,
      walletAddress: '', // Will be computed during deployment
      transactionHash: claimData.txHash
    };
  }

  async getClaimStatus(token: string): Promise<ClaimStatus> {
    const { getClaimData } = await import('./claim-code');
    const claimData = getClaimData(token);

    if (!claimData) {
      return {
        token,
        status: 'invalid',
        email: '',
        walletAddress: '',
        assets: [],
        expiresAt: '',
        isExpired: true
      };
    }

    return {
      token,
      status: 'pending',
      email: claimData.recipientEmail,
      walletAddress: '',
      assets: claimData.assets,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isExpired: false
    };
  }

  async deployAndClaim(data: ClaimDeploymentData): Promise<ClaimDeploymentResponse> {
    // Get claim data from the token (claim code)
    const { getClaimData, deleteClaimCode } = await import('./claim-code');
    const claimData = getClaimData(data.token);

    if (!claimData) {
      throw new Error('Invalid claim code');
    }

    const email = claimData.recipientEmail;

    const result = await walletService.deployWallet({
      email,
      ownerAddress: data.ownerAddress,
      useGasSponsoring: data.useGasSponsoring
    });

    // Delete claim code after successful claim
    if (result.success) {
      deleteClaimCode(data.token);
    }

    return {
      success: result.success,
      walletAddress: result.walletAddress,
      assets: claimData.assets,
      transactionHash: result.transactionHash,
      gasSponsored: result.gasSponsored
    };
  }

  async isClaimTokenValid(token: string): Promise<boolean> {
    return true;
  }

  async getClaimSummary(token: string): Promise<ClaimSummary> {
    return {
      totalAssets: 0,
      hasERC20: false,
      hasNFT: false,
      hasETH: false,
      expiresIn: 168
    };
  }

  formatAssetsForDisplay(assets: CryptoAsset[]): string[] {
    return assets.map(asset => {
      switch (asset.type) {
        case 'erc20':
          return `${asset.amount} ${asset.symbol}`;
        case 'eth':
          return `${asset.amount} ETH`;
        case 'nft':
          return `NFT #${asset.tokenId}`;
        default:
          return 'Unknown Asset';
      }
    });
  }

  isClaimExpiringSoon(status: ClaimStatus): boolean {
    return false;
  }

  getTimeUntilExpiration(status: ClaimStatus): {
    days: number;
    hours: number;
    minutes: number;
    isExpired: boolean;
  } {
    return { days: 7, hours: 0, minutes: 0, isExpired: false };
  }

  isValidClaimTokenFormat(token: string): boolean {
    return true;
  }

  async deployAndClaimWithRetry(
    data: ClaimDeploymentData,
    maxRetries: number = 3
  ): Promise<ClaimDeploymentResponse> {
    return this.deployAndClaim(data);
  }

  getClaimUrl(token: string, baseUrl: string = window.location.origin): string {
    return `${baseUrl}/dashboard/claim?token=${encodeURIComponent(token)}`;
  }
}

export const claimService = new ClaimService();
export default ClaimService;