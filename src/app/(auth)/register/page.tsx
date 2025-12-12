'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Wallet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useBasename } from "@/hooks/use-basename";
import { useAuth } from "@/contexts/auth-context";
import { authService } from "@/lib/auth-service";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEvmAddress, useIsSignedIn, useSignInWithEmail, useVerifyEmailOTP, useSignOut, useSendEvmTransaction } from "@coinbase/cdp-hooks";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { register } = useAuth();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const { sendEvmTransaction } = useSendEvmTransaction();
  const {
    address,
    isConnected,
    isSigning,
    isAuthenticating,
    connectWallet,
    disconnect,
    registerWithWallet
  } = useWallet();
  const {
    basename,
    isLoading: isFetchingBasename,
    fetchBasename,
    generateEmailFromBasename
  } = useBasename();

  const [useWalletAuth, setUseWalletAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [embeddedEmail, setEmbeddedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpFlowId, setOtpFlowId] = useState<string | null>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isFinishingEmbedded, setIsFinishingEmbedded] = useState(false);
  const [embeddedComplete, setEmbeddedComplete] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [authComplete, setAuthComplete] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogDescription, setDialogDescription] = useState('');

  const handleWalletConnect = async () => {
    try {
      setError('');
      await connectWallet();

      // Once connected, fetch basename
      if (address) {
        const fetchedBasename = await fetchBasename(address);
        if (fetchedBasename) {
          const emailAddress = generateEmailFromBasename(fetchedBasename);
          setGeneratedEmail(emailAddress);
          setEmail(emailAddress); // Set as default but allow editing
        }
      }
    } catch (error) {
      setError('Failed to connect wallet or fetch basename');
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWalletRegistration = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    const constructedEmail = `${email}@${process.env.NEXT_PUBLIC_DOMAIN}`;
    console.log('handleWalletRegistration called with email:', constructedEmail);

    try {
      setError('');

      // Use the wallet hook's registerWithWallet which handles signature
      await registerWithWallet(constructedEmail);

      setAuthComplete(true);

      toast({
        title: "Registration Successful",
        description: "Welcome to DexMail!",
      });

      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const resetWalletConnection = () => {
    disconnect();
    setAuthComplete(false);
    setGeneratedEmail('');
    setEmail('');
    setError('');
  };

  const resetEmbeddedFlow = () => {
    setEmbeddedEmail('');
    setOtpCode('');
    setOtpFlowId(null);
    setIsOtpSent(false);
    setIsOtpVerified(false);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setIsFinishingEmbedded(false);
    setEmbeddedComplete(false);
    setUsername('');
    setError('');
  };

  const handleEmbeddedSignOut = async () => {
    try {
      await signOut();
      resetEmbeddedFlow();
      toast({
        title: "Signed out",
        description: "You can now sign in with a different email.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      toast({
        title: "Sign out failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleSendOtp = async () => {
    if (!embeddedEmail.trim()) {
      setError('Please enter your email to receive a code');
      return;
    }

    // Clear error if email is provided
    setError('');
    setIsSendingOtp(true);

    try {
      const result = await signInWithEmail({ email: embeddedEmail.trim() });
      setOtpFlowId(result.flowId);
      setIsOtpSent(true);
      setDialogTitle('OTP Sent');
      setDialogDescription('Check your email for the 6-digit code to continue.');
      setDialogOpen(true);
      toast({
        title: "Check your email",
        description: "We sent a 6-digit code to continue.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      setError(message);
      toast({
        title: "OTP send failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpFlowId || !otpCode.trim()) {
      setError('Enter the 6-digit code to continue');
      return;
    }
    setIsVerifyingOtp(true);
    setError('');
    try {
      await verifyEmailOTP({ flowId: otpFlowId, otp: otpCode.trim() });
      setIsOtpVerified(true);
      setDialogTitle('Email Verified');
      setDialogDescription('Your email is verified. Choose a username to finish.');
      setDialogOpen(true);
      toast({
        title: "Verified",
        description: "Email verified. Choose a username to finish.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid or expired code';
      setError(message);
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleEmbeddedFinalize = async () => {
    // Check if user is signed in with Coinbase
    if (!isSignedIn) {
      setError('Please complete the sign-in process first');
      return;
    }

    if (!username.trim()) {
      setError('Pick a username to finish');
      return;
    }
    if (!evmAddress) {
      setError('Wallet address unavailable. Try signing in again.');
      return;
    }
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) {
      setError('Missing NEXT_PUBLIC_DOMAIN configuration');
      return;
    }

    const constructedEmail = `${username.trim()}@${domain}`;
    setIsFinishingEmbedded(true);
    setError('');
    try {
      // Import contract address and ABI
      const { BASEMAILER_ADDRESS, baseMailerAbi } = await import('@/lib/contracts');
      const { encodeFunctionData } = await import('viem');

      // Encode the contract function call
      const data = encodeFunctionData({
        abi: baseMailerAbi,
        functionName: 'registerEmailWithEmbeddedWallet',
        args: [constructedEmail]
      });

      // Send transaction using CDP's sendEvmTransaction
      const sendTransaction = async () => {
        const result = await sendEvmTransaction({
          transaction: {
            to: BASEMAILER_ADDRESS,
            data: data as `0x${string}`,
            chainId: 84532, // Base Sepolia
            type: "eip1559",
          },
          evmAccount: evmAddress,
          network: "base-sepolia",
        });

        return result.transactionHash;
      };

      // Use the new registerWithEmbeddedWallet method from authService
      await authService.registerWithEmbeddedWallet(constructedEmail, evmAddress, sendTransaction);
      setEmbeddedComplete(true);
      setDialogTitle('Account Created');
      setDialogDescription('Welcome to DexMail! Redirecting you to your inbox.');
      setDialogOpen(true);
      toast({
        title: "Account created",
        description: "Welcome to DexMail with your embedded wallet!",
      });
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finish registration';
      setError(message);
      toast({
        title: "Registration failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsFinishingEmbedded(false);
    }
  };

  return (
    <div className="text-center space-y-8">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {dialogDescription && (
              <DialogDescription>{dialogDescription}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => setDialogOpen(false)}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Illustration */}
      <div className="relative h-64 w-full">
        <Image
          src="/illustrations/register.svg"
          alt="Create DexMail Account"
          width={320}
          height={320}
          className="w-full h-full object-contain"
          priority
        />
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">
          Create Your Account
        </h1>
        <p className="text-slate-600 leading-relaxed px-4">
          Join DexMail to send emails with crypto transfers and manage your digital assets.
        </p>
      </div>

      {/* Registration Form */}
      <div className="space-y-6">
        {/* Wallet Registration Option */}
        <div className="flex items-center space-x-3 justify-start px-1">
          <Checkbox
            id="use-wallet"
            checked={useWalletAuth}
            onCheckedChange={(checked) => {
              setUseWalletAuth(checked as boolean);
              if (!checked) {
                resetWalletConnection();
              } else {
                resetEmbeddedFlow();
              }
              setError('');
            }}
          />
          <Label htmlFor="use-wallet" className="text-sm font-medium text-slate-700">
            Use external wallet instead of Coinbase embedded wallet
          </Label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {!useWalletAuth ? (
            // Coinbase Embedded Wallet (Option B - Custom UI)
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-left">
              {!isSignedIn ? (
                // Step 1: Email input and OTP sending
                <>
                  <div className="space-y-2">
                    <Label htmlFor="embedded-email" className="text-slate-700 font-medium">
                      Email for Coinbase sign-in
                    </Label>
                    <Input
                      id="embedded-email"
                      type="email"
                      placeholder="you@example.com"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-slate-900 placeholder:text-slate-500"
                      value={embeddedEmail}
                      onChange={(e) => {
                        setEmbeddedEmail(e.target.value);
                        // Clear error when user starts typing
                        if (error === 'Please enter your email to receive a code') {
                          setError('');
                        }
                      }}
                      disabled={isOtpSent}
                      required
                    />
                    <Button
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || isOtpSent || !embeddedEmail.trim()}
                      className="w-full h-11 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending code...
                        </>
                      ) : (
                        'Send OTP'
                      )}
                    </Button>
                  </div>

                  {/* Step 2: OTP verification (only show if OTP was sent but user not yet signed in) */}
                  {isOtpSent && !isSignedIn && (
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="embedded-otp" className="text-slate-700 font-medium">
                        Enter 6-digit code
                      </Label>
                      <Input
                        id="embedded-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-slate-900 placeholder:text-slate-500"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        required
                      />
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp}
                        className="w-full h-11 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify code'
                        )}
                      </Button>
                    </div>
                  )}

                </>
              ) : !embeddedComplete ? (
                // Step 3: Username selection (show when signed in but account not created)
                <>
                  <div className="space-y-4 pt-2">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                      <div className="flex items-center justify-between">
                        <span>✓ Signed in with Coinbase. Embedded wallet ready {evmAddress ? `(EVM: ${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)})` : ''}.</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEmbeddedSignOut}
                          className="h-7 text-xs text-green-700 hover:text-green-900 hover:bg-green-100"
                        >
                          Sign Out
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="embedded-username" className="text-slate-700 font-medium">
                        Pick a DexMail username
                      </Label>
                      <Input
                        id="embedded-username"
                        type="text"
                        placeholder="username"
                        className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-slate-900 placeholder:text-slate-500"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                      <p className="text-xs text-slate-500">
                        This becomes your DexMail address ({process.env.NEXT_PUBLIC_DOMAIN ? `@${process.env.NEXT_PUBLIC_DOMAIN}` : 'domain not set'}).
                      </p>
                    </div>
                    <Button
                      onClick={handleEmbeddedFinalize}
                      disabled={isFinishingEmbedded || !username.trim()}
                      className="w-full h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
                    >
                      {isFinishingEmbedded ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        'Finish creating account'
                      )}
                    </Button>

                    <div className="text-sm text-slate-600">
                      Already have an account?{" "}
                      <Link href="/login" className="text-brand-blue hover:text-brand-blue-hover font-medium">
                        Sign in
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                // Step 4: Success message
                <div className="text-center space-y-3">
                  <CheckCircle className="mx-auto h-10 w-10 text-brand-blue" />
                  <p className="text-sm font-medium text-slate-900">
                    Account created with Coinbase embedded wallet!
                  </p>
                  <p className="text-xs text-slate-600">
                    Redirecting you to your inbox...
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Wallet Registration
            <div className="space-y-4">
              {!isConnected ? (
                // Wallet Connection
                <div className="text-center space-y-3">
                  <div className="p-6 bg-slate-50 rounded-2xl">
                    <Wallet className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                    <p className="text-sm font-medium text-slate-600 mb-4">
                      Connect your wallet to continue
                    </p>
                    <ConnectButton.Custom>
                      {({
                        account,
                        chain,
                        openAccountModal,
                        openChainModal,
                        openConnectModal,
                        authenticationStatus,
                        mounted,
                      }) => {
                        const ready = mounted && authenticationStatus !== 'loading';
                        const connected =
                          ready &&
                          account &&
                          chain &&
                          (!authenticationStatus ||
                            authenticationStatus === 'authenticated');

                        return (
                          <Button
                            onClick={connected ? openAccountModal : openConnectModal}
                            disabled={!ready}
                            className="w-full h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
                          >
                            {!ready ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : connected ? (
                              'Wallet Connected'
                            ) : (
                              'Connect Wallet'
                            )}
                          </Button>
                        );
                      }}
                    </ConnectButton.Custom>
                  </div>
                </div>
              ) : !authComplete ? (
                // Basename fetching and email generation
                <div className="space-y-4">
                  <div className="text-center space-y-3">
                    <div className="p-6 bg-brand-blue/10 rounded-2xl">
                      <CheckCircle className="mx-auto h-8 w-8 text-brand-blue mb-3" />
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        Wallet Connected
                      </p>
                      <p className="text-xs text-slate-600 mb-4">
                        Address: {address?.slice(0, 6)}...{address?.slice(-4)}
                      </p>

                      {isFetchingBasename ? (
                        <div className="space-y-2">
                          <Loader2 className="mx-auto h-6 w-6 text-brand-blue animate-spin" />
                          <p className="text-xs text-slate-600">Fetching basename...</p>
                        </div>
                      ) : basename ? (
                        <div className="space-y-3">
                          <div className="bg-slate-100 p-3 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Found basename:</p>
                            <p className="text-sm font-mono font-semibold text-slate-900">{basename}</p>
                            <p className="text-xs text-slate-500 mt-1">Generated email:</p>
                            <p className="text-sm font-mono font-semibold text-brand-blue">{generatedEmail}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">No basename found for this wallet</p>
                      )}
                    </div>
                  </div>

                  {/* Email field (editable) */}
                  <div className="text-left space-y-2">
                    <Label htmlFor="wallet-email" className="text-slate-700 font-medium">
                      Email Address {generatedEmail && '(auto-generated, editable)'}
                    </Label>
                    <Input
                      id="wallet-email"
                      type="email"
                      placeholder="Enter your email or edit the generated one"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-slate-900 placeholder:text-slate-500"
                      value={email}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmail(val);
                        if (val.includes('@') || val.includes('.')) {
                          setError("Please enter only your username (without '@' or domain extensions)");
                        } else {
                          setError('');
                        }
                      }}
                      required
                    />
                  </div>

                  <Button
                    onClick={handleWalletRegistration}
                    disabled={isSigning || isAuthenticating || !email.trim() || !!error}
                    className="w-full h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing...
                      </>
                    ) : isAuthenticating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Sign to Create Account'
                    )}
                  </Button>
                  {!email.trim() && (
                    <p className="text-xs text-amber-600">Please enter an email address</p>
                  )}
                </div>
              ) : (
                // Registration Complete
                <div className="text-center space-y-4">
                  <div className="p-6 bg-brand-blue/10 rounded-2xl">
                    <CheckCircle className="mx-auto h-12 w-12 text-brand-blue mb-4" />
                    <p className="text-sm font-medium text-slate-900 mb-2">
                      Account Created Successfully!
                    </p>
                    <p className="text-xs text-slate-600 mb-3">
                      Registered with wallet signature
                    </p>
                    <div className="bg-slate-100 p-2 rounded-lg space-y-1">
                      <p className="text-xs text-slate-500">
                        Email: <span className="font-mono">{email}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Wallet: <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </p>
                      {basename && (
                        <p className="text-xs text-slate-500">
                          Basename: <span className="font-mono">{basename}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sign in link */}
        {useWalletAuth && !authComplete && (
          <div className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-blue hover:text-brand-blue-hover font-medium">
              Sign in with wallet
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}