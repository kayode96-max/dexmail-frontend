'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Gift, KeyRound, Loader2, Wallet, AlertCircle } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { cryptoService } from '@/lib/crypto-service';
import { ClaimStatus, CryptoAsset } from '@/lib/types';

type Step = 1 | 2 | 3 | 4;

export default function ClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { address, isConnected, connectWallet } = useWallet();
  
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [error, setError] = useState('');
  const [walletDeployed, setWalletDeployed] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');

  // Check for claim token in URL params
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setClaimToken(token);
      verifyClaimToken(token);
    }
  }, [searchParams]);

  const verifyClaimToken = async (token: string) => {
    if (!token.trim()) {
      setError('Please enter a valid claim token');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const status = await cryptoService.getClaimStatus(token);
      setClaimStatus(status);
      
      if (status.status === 'claimed') {
        setStep(4);
        toast({
          title: "Already Claimed",
          description: "This claim token has already been used.",
          variant: "destructive",
        });
      } else if (status.status === 'expired') {
        setError('This claim token has expired');
        toast({
          title: "Token Expired",
          description: "This claim token has expired and can no longer be used.",
          variant: "destructive",
        });
      } else {
        setStep(2);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify claim token';
      setError(errorMessage);
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deployWalletAndClaim = async () => {
    if (!isConnected || !address || !claimToken) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const result = await cryptoService.deployAndClaim(claimToken, address, true);
      
      setWalletDeployed(true);
      setTransactionHash(result.transactionHash);
      setStep(4);
      
      toast({
        title: "Claim Successful!",
        description: "Your crypto assets have been claimed to your wallet.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deploy wallet and claim assets';
      setError(errorMessage);
      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      await verifyClaimToken(claimToken);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      await deployWalletAndClaim();
    }
  };

  const renderAssetValue = (asset: CryptoAsset) => {
    if (asset.type === 'eth') {
      return `${asset.amount} ETH`;
    } else if (asset.type === 'erc20') {
      return `${asset.amount} ${asset.symbol}`;
    } else if (asset.type === 'nft') {
      return `NFT #${asset.tokenId}`;
    }
    return 'Unknown Asset';
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4 md:p-6">
      <Card className="w-full max-w-md md:max-w-lg shadow-lg border">
        {step === 1 && (
          <Step1 
            claimToken={claimToken}
            setClaimToken={setClaimToken}
            onNext={handleNextStep}
            isLoading={isLoading}
            error={error}
          />
        )}
        {step === 2 && (
          <Step2 
            claimStatus={claimStatus}
            onNext={handleNextStep}
            isLoading={isLoading}
            error={error}
            renderAssetValue={renderAssetValue}
          />
        )}
        {step === 3 && (
          <Step3 
            claimStatus={claimStatus}
            isConnected={isConnected}
            address={address}
            connectWallet={connectWallet}
            onNext={handleNextStep}
            isLoading={isLoading}
            error={error}
            renderAssetValue={renderAssetValue}
          />
        )}
        {step === 4 && (
          <Step4 
            claimStatus={claimStatus}
            transactionHash={transactionHash}
            renderAssetValue={renderAssetValue}
          />
        )}
      </Card>
    </div>
  );
}

function Step1({ 
  claimToken,
  setClaimToken,
  onNext, 
  isLoading,
  error
}: { 
  claimToken: string;
  setClaimToken: (token: string) => void;
  onNext: () => void; 
  isLoading: boolean;
  error: string;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Claim Your Crypto
        </CardTitle>
        <CardDescription>
          Enter your claim token to start the claiming process.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="claim-token">Claim Token</Label>
          <Input
            id="claim-token"
            placeholder="Enter your claim token"
            value={claimToken}
            onChange={(e) => setClaimToken(e.target.value)}
            className="font-mono"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onNext} 
          disabled={!claimToken.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Token'
          )}
        </Button>
      </CardFooter>
    </>
  );
}

function Step2({ 
  claimStatus,
  onNext, 
  isLoading,
  error,
  renderAssetValue
}: { 
  claimStatus: ClaimStatus | null;
  onNext: () => void; 
  isLoading: boolean;
  error: string;
  renderAssetValue: (asset: CryptoAsset) => string;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          Token Verified
        </CardTitle>
        <CardDescription>
          Your claim token is valid. Review the assets you'll receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {claimStatus && (
          <div className="space-y-3">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">Claim Details:</p>
              <p className="text-xs text-slate-500 mb-1">Recipient: {claimStatus.email}</p>
              <p className="text-xs text-slate-500 mb-3">Expires: {new Date(claimStatus.expiresAt).toLocaleDateString()}</p>
              
              <p className="text-sm font-medium text-slate-700 mb-2">Assets to claim:</p>
              <div className="space-y-1">
                {claimStatus.assets.map((asset, index) => (
                  <div key={index} className="text-sm text-slate-600 bg-white p-2 rounded border">
                    {renderAssetValue(asset)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onNext} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Connect Wallet'
          )}
        </Button>
      </CardFooter>
    </>
  );
}

function Step3({ 
  claimStatus,
  isConnected,
  address,
  connectWallet,
  onNext, 
  isLoading,
  error,
  renderAssetValue
}: { 
  claimStatus: ClaimStatus | null;
  isConnected: boolean;
  address: string | undefined;
  connectWallet: () => Promise<void>;
  onNext: () => void; 
  isLoading: boolean;
  error: string;
  renderAssetValue: (asset: CryptoAsset) => string;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-blue-600" />
          Connect Wallet
        </CardTitle>
        <CardDescription>
          Connect your wallet to deploy a smart wallet and claim your assets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {!isConnected ? (
          <div className="text-center space-y-4">
            <div className="p-6 bg-slate-50 rounded-lg">
              <Wallet className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-4">
                Connect your wallet to receive the claimed assets
              </p>
              <Button onClick={connectWallet} className="w-full">
                Connect Wallet
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">Wallet Connected</p>
              </div>
              <p className="text-xs text-green-600 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            
            {claimStatus && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800 mb-2">Ready to claim:</p>
                <div className="space-y-1">
                  {claimStatus.assets.map((asset, index) => (
                    <div key={index} className="text-sm text-blue-700">
                      • {renderAssetValue(asset)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onNext} 
          disabled={!isConnected || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Claiming...
            </>
          ) : (
            'Deploy Wallet & Claim'
          )}
        </Button>
      </CardFooter>
    </>
  );
}

function Step4({ 
  claimStatus,
  transactionHash,
  renderAssetValue
}: { 
  claimStatus: ClaimStatus | null;
  transactionHash: string;
  renderAssetValue: (asset: CryptoAsset) => string;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          Claim Successful!
        </CardTitle>
        <CardDescription>
          Your crypto assets have been successfully claimed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-4">
          <div className="p-6 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
            <p className="text-lg font-semibold text-green-800 mb-2">Assets Claimed!</p>
            
            {claimStatus && (
              <div className="space-y-2">
                <p className="text-sm text-green-700 mb-3">Successfully claimed:</p>
                <div className="space-y-1">
                  {claimStatus.assets.map((asset, index) => (
                    <div key={index} className="text-sm font-medium text-green-800 bg-white p-2 rounded border">
                      {renderAssetValue(asset)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {transactionHash && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-xs text-green-600 mb-1">Transaction Hash:</p>
                <p className="text-xs font-mono text-green-700 break-all">
                  {transactionHash}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => window.location.href = '/dashboard'}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </CardFooter>
    </>
  );
}