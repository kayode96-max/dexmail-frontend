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
import { Wallet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth-service";

import { useEvmAddress, useIsSignedIn, useSignInWithEmail, useVerifyEmailOTP, useSignOut } from "@coinbase/cdp-hooks";

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

      const domain = process.env.NEXT_PUBLIC_DOMAIN || 'dexmail.app';
      const fullEmail = email.includes('@') ? email : `${email}@${domain}`;

      console.log('[Login] Authenticating with:', fullEmail);

      const challenge = await authService.getChallenge(fullEmail);

      const signature = await signMessage(challenge.nonce);
      await loginWithWallet(fullEmail, address, signature);

      setAuthComplete(true);

      toast({
        title: "Login Successful",
        description: "Welcome back to DexMail!",
      });

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
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
    <div className="flex flex-col lg:flex-row min-h-full gap-4 lg:gap-0">


      {/* Illustration - Top on mobile, Left on desktop */}
      <div className="w-full lg:w-3/5 relative flex-shrink-0 h-96 lg:h-[600px]">
        <Image
          src="/illustrations/login.svg"
          alt="Login to DexMail"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Content */}
      <div className='text-center space-y-4 lg:space-y-8 w-full lg:w-2/5 px-4 md:px-8 lg:px-12 py-4 lg:py-0 flex flex-col justify-center overflow-y-auto lg:overflow-visible'>
        <div className="space-y-8 ">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            Welcome Back
          </h1>
          <p className="text-slate-600 leading-relaxed px-4">
            Sign in to access your secure email and crypto features.
          </p>
        </div>

        {/* Login Form */}
        <div className="space-y-14 max-w-[560px] mx-auto w-full">
          {/* Wallet Connection Option */}
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
              Sign in with external wallet instead of Coinbase
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
              // Coinbase Embedded Wallet Login
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-left">
                {!isSignedIn ? (
                  // Step 1: Email input and OTP sending
                  <>
                    {/* Step 1: Email input - hide when OTP is sent */}
                    {!isOtpSent && (
                      <div className="space-y-2">
                        <Label htmlFor="embedded-email" className="text-slate-700 font-medium">
                          Email for Coinbase sign-in
                        </Label>
                        <Input
                          id="embedded-email"
                          type="email"
                          placeholder="you@example.com"
                          className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-black placeholder:text-slate-500"
                          style={{ colorScheme: 'light' }}
                          value={embeddedEmail}
                          onChange={(e) => {
                            setEmbeddedEmail(e.target.value);
                            if (error === 'Please enter your email to receive a code') {
                              setError('');
                            }
                          }}
                          required
                        />
                        <Button
                          onClick={handleSendOtp}
                          disabled={isSendingOtp || !embeddedEmail.trim()}
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
                    )}

                    {/* Step 2: OTP verification */}
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
                          className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-black placeholder:text-slate-500"
                          style={{ colorScheme: 'light' }}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          required
                        />
                        <Button
                          onClick={handleVerifyOtp}
                          disabled={isVerifyingOtp || isFinishingEmbedded}
                          className="w-full h-11 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
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
                      </div>
                    )}
                  </>
                ) : !embeddedComplete ? (
                  // Step 3: Signing in (auto-triggered after verification)
                  <div className="text-center space-y-3 py-4">
                    <Loader2 className="mx-auto h-10 w-10 text-brand-blue animate-spin" />
                    <p className="text-sm font-medium text-slate-900">
                      Signing you in...
                    </p>
                  </div>
                ) : (
                  // Step 4: Success message
                  <div className="text-center space-y-3">
                    <CheckCircle className="mx-auto h-10 w-10 text-brand-blue" />
                    <p className="text-sm font-medium text-slate-900">
                      Signed in with Coinbase embedded wallet!
                    </p>
                    <p className="text-xs text-slate-600">
                      Redirecting you to your inbox...
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Wallet Signature Authentication
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
                  // Signature Authentication
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
                      </div>
                    </div>

                    {/* Email field for external wallet */}
                    <div className="text-left space-y-2">
                      <Label htmlFor="wallet-email" className="text-slate-700 font-medium">
                        DexMail Username
                      </Label>
                      <div className="relative">
                        <Input
                          id="wallet-email"
                          type="text"
                          placeholder="username"
                          className="h-12 bg-white border-slate-200 rounded-xl focus:border-slate-400 focus:ring-slate-400 text-black placeholder:text-slate-500 pr-32"
                          style={{ colorScheme: 'light' }}
                          value={email}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes('@') || val.includes('dexmail.app')) {
                              setError("Please enter only your username, do not include '@dexmail.app'");
                              setEmail(val.replace(/[@]/g, '').replace('dexmail.app', ''));
                            } else {
                              setError('');
                              setEmail(val);
                            }
                          }}
                          required
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 font-medium bg-transparent">
                          @dexmail.app
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleWalletAuth}
                      disabled={isSigning || isAuthenticating || !email.trim()}
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
                          Signing In...
                        </>
                      ) : (
                        'Sign to Login'
                      )}
                    </Button>
                    {!email.trim() && (
                      <p className="text-xs text-amber-600 mt-2">
                        Please enter your username
                      </p>
                    )}
                  </div>
                ) : (
                  // Authentication Complete
                  <div className="text-center space-y-4">
                    <div className="p-6 bg-brand-blue/10 rounded-2xl">
                      <CheckCircle className="mx-auto h-12 w-12 text-brand-blue mb-4" />
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        Signed In Successfully!
                      </p>
                      <p className="text-xs text-slate-600 mb-3">
                        Authenticated with wallet signature
                      </p>
                      <div className="bg-slate-100 p-2 rounded-lg space-y-1">
                        <p className="text-xs text-slate-500">
                          Email: <span className="font-mono">{email}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Wallet: <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sign up link */}
          {!authComplete && !embeddedComplete && (
            <div className="text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-brand-blue hover:text-brand-blue-hover font-medium">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}