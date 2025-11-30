'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { claimService } from '@/lib/claim-service';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { useToast } from '@/hooks/use-toast';
import { CryptoAsset } from '@/lib/types';

type Step = 1 | 2 | 3 | 4;

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [deployedAddress, setDeployedAddress] = useState('');
  const [claimAssets, setClaimAssets] = useState<CryptoAsset[]>([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const { toast } = useToast();

  // Auto-fill claim code from URL parameter
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setClaimToken(codeFromUrl);
      console.log('[ClaimPage] Auto-filled claim code from URL:', codeFromUrl);
    }
  }, [searchParams]);

  const handleVerifyToken = async () => {
    if (!claimToken) {
      toast({
        title: "Missing Claim Code",
        description: "Please enter a claim code to continue.",
        variant: "destructive",
      });
      return;
    }

    // Validate claim code format (6 digits)
    if (!/^\d{6}$/.test(claimToken)) {
      toast({
        title: "Invalid Format",
        description: "Claim code must be exactly 6 digits.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await claimService.verifyClaimToken(claimToken);
      if (response.valid) {
        setClaimAssets(response.assets);
        setRecipientEmail(response.email);

        toast({
          title: "Claim Code Verified!",
          description: `Found ${response.assets.length} asset(s) to claim.`,
        });

        setStep(2);
      } else {
        toast({
          title: "Invalid Claim Code",
          description: "This claim code is not valid or has already been used.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Could not verify claim code.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);
    // Mock verification
    setTimeout(() => {
      setStep(3);
      setIsLoading(false);
    }, 1000);
  };

  const handleDeploy = async (ownerAddress: string) => {
    setIsLoading(true);
    try {
      const result = await claimService.deployAndClaim({
        token: claimToken,
        ownerAddress,
        useGasSponsoring: true
      });

      if (result.success) {
        setDeployedAddress(result.walletAddress || '');
        setStep(4);
      } else {
        alert('Deployment failed');
      }
    } catch (error) {
      console.error(error);
      alert('Deployment failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4 md:p-6">
      <Card className="w-full max-w-md md:max-w-lg shadow-lg border">
        {step === 1 && (
          <Step1
            onNext={handleVerifyToken}
            isLoading={isLoading}
            token={claimToken}
            setToken={setClaimToken}
          />
        )}
        {step === 2 && <Step2 onNext={handleVerifyCode} isLoading={isLoading} assets={claimAssets} recipientEmail={recipientEmail} />}
        {step === 3 && <Step3 onDeploy={handleDeploy} isLoading={isLoading} />}
        {step === 4 && <Step4 walletAddress={deployedAddress} />}
      </Card>
    </div>
  );
}

function Step1({
  onNext,
  isLoading,
  token,
  setToken
}: {
  onNext: () => void;
  isLoading: boolean;
  token: string;
  setToken: (t: string) => void;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Claim Your Crypto
        </CardTitle>
        <CardDescription>
          Enter the 6-digit claim code from your email to begin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Label htmlFor="claim-token">Claim Code</Label>
          <Input
            id="claim-token"
            placeholder="Enter 6-digit code (e.g., 123456)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={6}
            pattern="\d{6}"
          />
          <p className="text-xs text-muted-foreground">
            The claim code should be a 6-digit number from your email.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onNext} className="w-full" disabled={isLoading || !token || token.length !== 6}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify Code
        </Button>
      </CardFooter>
    </>
  );
}

function Step2({
  onNext,
  isLoading,
  assets,
  recipientEmail
}: {
  onNext: () => void;
  isLoading: boolean;
  assets: CryptoAsset[];
  recipientEmail: string;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-500" />
          Claim Verified!
        </CardTitle>
        <CardDescription>
          Review the assets you&apos;re about to claim for {recipientEmail}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-semibold mb-3">Assets to Claim:</h4>
            <div className="space-y-2">
              {assets.map((asset, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {asset.type === 'eth' ? '💎' : asset.type === 'nft' ? '🖼️' : '🪙'}
                    </span>
                    <div>
                      <p className="font-medium">
                        {asset.type === 'eth' && `${asset.amount} ETH`}
                        {asset.type === 'erc20' && `${asset.amount} ${asset.symbol || 'tokens'}`}
                        {asset.type === 'nft' && `NFT #${asset.tokenId}`}
                      </p>
                      {asset.token && asset.type !== 'eth' && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {asset.token.slice(0, 6)}...{asset.token.slice(-4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Click continue to set up your wallet and claim these assets.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onNext} className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue to Wallet Setup
        </Button>
      </CardFooter>
    </>
  );
}

function Step3({ onDeploy, isLoading }: { onDeploy: (addr: string) => void; isLoading: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const handleConnectWallet = () => {
    if (isConnected && address) {
      onDeploy(address);
    } else {
      connect({ connector: injected() });
      // Wait for connection? Ideally use effect, but for now user clicks again
    }
  };

  const handleCreatePassword = () => {
    // Generate a random wallet for now
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    onDeploy(account.address);
    // In real app, we'd save the encrypted key or send it to backend
    console.log('Generated Private Key:', privateKey);
    alert('Generated a new wallet. Private Key (Save this!): ' + privateKey);
  };

  return (
    <>
      <CardHeader>
        <CardTitle>Secure Your New Wallet</CardTitle>
        <CardDescription>
          Choose how you want to access your new non-custodial wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start h-auto py-4"
          onClick={handleCreatePassword}
          disabled={isLoading}
        >
          <KeyRound className="mr-4 h-6 w-6 text-muted-foreground" />
          <div className="text-left">
            <p className="font-semibold">Create a Password (Generate New Wallet)</p>
            <p className="text-sm text-muted-foreground">
              Traditional and easy. Secured by your email.
            </p>
          </div>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start h-auto py-4"
          onClick={handleConnectWallet}
          disabled={isLoading}
        >
          <Wallet className="mr-4 h-6 w-6 text-muted-foreground" />
          <div className="text-left">
            <p className="font-semibold">
              {isConnected ? `Use Connected Wallet (${address?.slice(0, 6)}...)` : 'Connect Existing Wallet'}
            </p>
            <p className="text-sm text-muted-foreground">
              For experienced users. Link your MetaMask, etc.
            </p>
          </div>
        </Button>
      </CardContent>
      <CardFooter>
        {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      </CardFooter>
    </>
  );
}

function Step4({ walletAddress }: { walletAddress: string }) {
  return (
    <>
      <CardHeader className="items-center text-center">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <CardTitle className="text-2xl">Claim Successful!</CardTitle>
        <CardDescription>
          Your wallet has been deployed and funds are available.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        <p className="font-mono bg-muted p-2 rounded-md break-all">
          Wallet Address: {walletAddress}
        </p>
        <p className="mt-4">
          You can now manage your assets from the DexMail dashboard.
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <a href="/dashboard">Go to Dashboard</a>
        </Button>
      </CardFooter>
    </>
  );
}
