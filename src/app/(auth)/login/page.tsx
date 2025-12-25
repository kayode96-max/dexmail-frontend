'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth-service";

import { useEvmAddress, useIsSignedIn, useSignInWithEmail, useVerifyEmailOTP, useSignOut } from "@coinbase/cdp-hooks";
import { SiweMessage } from 'siwe';
import { useAccount } from 'wagmi';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, loginWithWallet, refreshUser } = useAuth();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const {
    address,
    isConnected,
    isConnecting,
    isSigning,
    isAuthenticating,
    connectWallet,
    disconnect,
    signMessage
  } = useWallet();

  const [useWalletAuth, setUseWalletAuth] = useState(false);
  const { chain } = useAccount();
  const [email, setEmail] = useState('');
  const [authComplete, setAuthComplete] = useState(false);
  const [error, setError] = useState('');

  // Coinbase embedded wallet states
  const [embeddedEmail, setEmbeddedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpFlowId, setOtpFlowId] = useState<string | null>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isFinishingEmbedded, setIsFinishingEmbedded] = useState(false);
  const [embeddedComplete, setEmbeddedComplete] = useState(false);

  // Auto sign out from CDP when landing on login page (after logout)
  useEffect(() => {
    const autoSignOut = async () => {
      // Always clear any persisted DexMail auth when visiting the login page
      try {
        authService.logout();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      } catch (err) {
        console.error('[Login] Failed to clear local auth on mount:', err);
      }

      if (isSignedIn) {
        try {
          console.log('[Login] Auto-signing out from previous CDP session');
          await signOut();
        } catch (error) {
          console.error('[Login] Failed to auto sign out:', error);
        }
      }
    };
    autoSignOut();
  }, []); // Run once on mount



  const handleWalletConnect = async () => {
    try {
      setError('');
      await connectWallet();
    } catch (error) {
      setError('Failed to connect wallet');
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };



  // ... existing code ...

  const handleWalletAuth = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setError('');

      // Always use actual browser domain for SIWE to avoid "suspicious sign-in" warnings
      const domain = window.location.host;
      const origin = window.location.origin;
      const fullEmail = email.includes('@') ? email : `${email}@dexmail.app`; // using hardcoded dexmail.app as fallback if env not set for consistency with regex below

      console.log('[Login] Authenticating with:', fullEmail);

      const challenge = await authService.getChallenge(fullEmail);

      // Create SIWE message
      const message = new SiweMessage({
        domain,
        address,
        statement: 'Sign in to DexMail to access your decentralized inbox.',
        uri: origin,
        version: '1',
        chainId: chain?.id || 8453, // Base mainnet
        nonce: challenge.nonce,
        issuedAt: new Date().toISOString(),
      });

      const preparedMessage = message.prepareMessage();
      const signature = await signMessage(preparedMessage);

      await loginWithWallet(fullEmail, address, preparedMessage, signature);

      setAuthComplete(true);

      toast({
        title: "Login Successful",
        description: "Welcome back to DexMail!",
      });

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Login error', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      toast({
        title: "Authentication Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const resetWalletConnection = () => {
    disconnect();
    setAuthComplete(false);
    setError('');
  };

  const resetEmbeddedFlow = () => {
    setEmbeddedEmail('');
    setOtpCode('');
    setOtpFlowId(null);
    setIsOtpSent(false);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setIsFinishingEmbedded(false);
    setEmbeddedComplete(false);
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

    setError('');
    setIsSendingOtp(true);

    try {
      const result = await signInWithEmail({ email: embeddedEmail.trim() });
      setOtpFlowId(result.flowId);
      setIsOtpSent(true);
      toast({
        title: "OTP Sent",
        description: "Check your email for the 6-digit code to continue.",
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
    console.log('[Login] handleVerifyOtp called');
    if (!otpFlowId || !otpCode.trim()) {
      setError('Enter the 6-digit code to continue');
      return;
    }
    setIsVerifyingOtp(true);
    setError('');
    try {
      console.log('[Login] Verifying OTP with flowId:', otpFlowId);
      await verifyEmailOTP({ flowId: otpFlowId, otp: otpCode.trim() });
      console.log('[Login] OTP verified successfully');

      // Set flag - useEffect will handle login when CDP session is ready
      setIsOtpVerified(true);

      toast({
        title: "Verified",
        description: "Setting up your session...",
      });
    } catch (err) {
      console.error('[Login] OTP verification failed:', err);
      const message = err instanceof Error ? err.message : 'Invalid or expired code';
      setError(message);
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      console.log('[Login] Setting isVerifyingOtp to false');
      setIsVerifyingOtp(false);
    }
  };

  // Auto-login when CDP session becomes ready after OTP verification
  useEffect(() => {
    const attemptLogin = async () => {
      if (isOtpVerified && isSignedIn && evmAddress && !isFinishingEmbedded && !embeddedComplete) {
        console.log('[Login] CDP session ready! Auto-triggering login');
        console.log('[Login] evmAddress:', evmAddress);


        try {
          await handleEmbeddedWalletLogin(evmAddress);
        } catch (err) {
          console.error('[Login] Auto-login failed:', err);
          const message = err instanceof Error ? err.message : 'Login failed';
          setError(message);
          toast({
            title: "Login failed",
            description: message,
            variant: "destructive",
          });
          setIsOtpVerified(false); // Reset to allow retry
        }
      }
    };

    attemptLogin();
  }, [isOtpVerified, isSignedIn, evmAddress, isFinishingEmbedded, embeddedComplete]);

  const handleEmbeddedWalletLogin = async (walletAddress: string) => {
    console.log('[Login] handleEmbeddedWalletLogin started');
    console.log('[Login] Email:', embeddedEmail);
    console.log('[Login] Wallet address:', walletAddress);

    setIsFinishingEmbedded(true);
    try {
      // Login using wallet address (primary identifier for embedded wallets)
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

      console.log('[Login] Sending login request to backend');
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: walletAddress.toLowerCase(),
          authType: 'coinbase-embedded',
        }),
      });

      console.log('[Login] Backend response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Login] Backend login failed:', errorData);
        throw new Error(errorData.error || 'Login failed');
      }

      const authResponse = await response.json();
      console.log('[Login] Login successful, auth response:', authResponse);

      // Store auth data in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', authResponse.token);
        localStorage.setItem('auth_user', JSON.stringify(authResponse.user));
      }

      // Update AuthContext with the logged-in user
      try {
        await refreshUser();
        console.log('[Login] User context refreshed successfully');
      } catch (err) {
        console.error('[Login] Failed to refresh user context:', err);
        // Continue anyway since data is in localStorage
      }

      setEmbeddedComplete(true);

      toast({
        title: "Login successful",
        description: "Welcome back to DexMail!",
      });
      console.log('[Login] Redirecting to dashboard in 1.2s');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      console.error('[Login] Embedded wallet login failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsFinishingEmbedded(false);
    }
  };

  const handleEmbeddedLogin = async () => {
    console.log('[Login] handleEmbeddedLogin started');
    console.log('[Login] isSignedIn:', isSignedIn);
    console.log('[Login] evmAddress:', evmAddress);
    console.log('[Login] embeddedEmail:', embeddedEmail);

    if (!isSignedIn) {
      console.error('[Login] Not signed in!');
      setError('Please complete the sign-in process first');
      return;
    }
    if (!evmAddress) {
      console.error('[Login] No EVM address!');
      setError('Wallet address unavailable. Try signing in again.');
      return;
    }

    setIsFinishingEmbedded(true);
    setError('');
    try {
      console.log('[Login] Calling login with:', { email: embeddedEmail, address: evmAddress });
      // Login with embedded wallet - using auth context
      await login(embeddedEmail, evmAddress, evmAddress, 'wallet');
      console.log('[Login] Login successful');
      setEmbeddedComplete(true);
      toast({
        title: "Login successful",
        description: "Welcome back to DexMail!",
      });
      console.log('[Login] Redirecting to dashboard in 1.2s');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      console.error('[Login] Login failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      console.log('[Login] Setting isFinishingEmbedded to false');
      setIsFinishingEmbedded(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome Back</h1>
                <p className="text-balance text-muted-foreground">
                  Sign in to access your secure email
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Wallet Connection Option */}
              <div className="flex items-center space-x-2">
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
                <Label htmlFor="use-wallet" className="text-sm font-medium cursor-pointer">
                  Use external wallet
                </Label>
              </div>

              {!useWalletAuth ? (
                // Coinbase Embedded Wallet Login
                <>
                  {!isSignedIn ? (
                    <>
                      {/* Step 1: Email input - hide when OTP is sent */}
                      {!isOtpSent && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="embedded-email">Email</Label>
                            <Input
                              id="embedded-email"
                              type="email"
                              placeholder="m@example.com"
                              value={embeddedEmail}
                              onChange={(e) => {
                                setEmbeddedEmail(e.target.value);
                                if (error === 'Please enter your email to receive a code') {
                                  setError('');
                                }
                              }}
                              required
                            />
                          </div>
                          <Button
                            onClick={handleSendOtp}
                            disabled={isSendingOtp || !embeddedEmail.trim()}
                            className="w-full"
                          >
                            {isSendingOtp ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending code...
                              </>
                            ) : (
                              'Send verification code'
                            )}
                          </Button>
                        </>
                      )}

                      {/* Step 2: OTP verification */}
                      {isOtpSent && !isSignedIn && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="embedded-otp">Verification Code</Label>
                            <Input
                              id="embedded-otp"
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="123456"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value)}
                              required
                            />
                          </div>
                          <Button
                            onClick={handleVerifyOtp}
                            disabled={isVerifyingOtp || isFinishingEmbedded}
                            className="w-full"
                          >
                            {isVerifyingOtp || isFinishingEmbedded ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isVerifyingOtp ? 'Verifying...' : 'Signing in...'}
                              </>
                            ) : (
                              'Verify & Sign In'
                            )}
                          </Button>
                        </>
                      )}
                    </>
                  ) : !embeddedComplete ? (
                    // Step 3: Signing in
                    <div className="text-center space-y-3 py-4">
                      <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin" />
                      <p className="text-sm font-medium">
                        Signing you in...
                      </p>
                    </div>
                  ) : (
                    // Step 4: Success message
                    <div className="text-center space-y-3 py-4">
                      <CheckCircle className="mx-auto h-10 w-10 text-primary" />
                      <p className="text-sm font-medium">
                        Signed in successfully!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Redirecting you to your inbox...
                      </p>
                    </div>
                  )}
                </>
              ) : (
                // Wallet Signature Authentication
                <>
                  {!isConnected ? (
                    // Wallet Connection
                    <div className="text-center space-y-4">
                      <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Connect your wallet to continue
                      </p>
                      <ConnectButton.Custom>
                        {({
                          account,
                          chain,
                          openAccountModal,
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
                              className="w-full"
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
                  ) : !authComplete ? (
                    // Signature Authentication
                    <>
                      <div className="text-center space-y-2 p-4 bg-primary/10 rounded-lg">
                        <CheckCircle className="mx-auto h-8 w-8 text-primary" />
                        <p className="text-sm font-medium">Wallet Connected</p>
                        <p className="text-xs text-muted-foreground">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="wallet-email">DexMail Username</Label>
                        <div className="relative">
                          <Input
                            id="wallet-email"
                            type="text"
                            placeholder="username"
                            className="pr-32"
                            value={email}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.includes('@') || val.includes('dexmail.app')) {
                                setError("Enter only your username");
                                setEmail(val.replace(/[@]/g, '').replace('dexmail.app', ''));
                              } else {
                                setError('');
                                setEmail(val);
                              }
                            }}
                            required
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                            @dexmail.app
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleWalletAuth}
                        disabled={isSigning || isAuthenticating || !email.trim()}
                        className="w-full"
                      >
                        {isSigning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing...
                          </>
                        ) : isAuthenticating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Authenticating...
                          </>
                        ) : (
                          'Sign to Login'
                        )}
                      </Button>
                    </>
                  ) : (
                    // Authentication Complete
                    <div className="text-center space-y-4 py-4">
                      <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                        <CheckCircle className="mx-auto h-12 w-12 text-primary" />
                        <p className="text-sm font-medium">Signed In Successfully!</p>
                        <p className="text-xs text-muted-foreground">
                          Authenticated with wallet signature
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!authComplete && !embeddedComplete && (
                <div className="text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="underline underline-offset-4 hover:text-primary">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </form>
          <div className="relative hidden flex-col items-center justify-center bg-muted p-8 md:flex">
            <Image
              src="/logo.png"
              alt="DexMail Logo"
              width={120}
              height={120}
              className="rounded-2xl mb-4"
              priority
            />
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Welcome to DexMail</h2>
              <p className="text-sm text-muted-foreground">
                Secure, decentralized email powered by blockchain technology.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our <Link href="#">Terms of Service</Link>{" "}
        and <Link href="#">Privacy Policy</Link>.
      </div>
    </div>
  );
}