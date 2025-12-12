import { AuthResponse, User } from './types';
import { readContract, writeContract } from '@wagmi/core';
import { wagmiConfig } from './wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from './contracts';

export interface RegisterData {
  email: string;
  password?: string;
  authType: 'wallet' | 'coinbase-embedded';
  walletAddress?: string;
  signature?: string;
}

export interface LoginData {
  email: string;
  password?: string;
  signature?: string;
  authType: 'wallet' | 'coinbase-embedded';
}

export interface ChallengeResponse {
  nonce: string;
  expires: number;
}

export interface LinkWalletData {
  email: string;
  walletAddress: string;
  signature: string;
}

class AuthService {
  private currentUser: User | null = null;
  private token: string | null = null;

  constructor() {
    // Initialize from localStorage on creation
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        this.token = storedToken;
        this.currentUser = JSON.parse(storedUser);
        console.log('[AuthService] Initialized with stored auth:', this.currentUser?.email);
      }
    }
  }

  async registerWithEmbeddedWallet(
    email: string,
    walletAddress: string,
    sendTransaction: () => Promise<string>
  ): Promise<AuthResponse> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

    try {
      // Step 1: Register email on blockchain contract using embedded wallet
      console.log('[AuthService] Registering email on blockchain:', email);
      const txHash = await sendTransaction();

      console.log('[AuthService] Blockchain registration successful:', txHash);

      // Step 2: Register user in backend database
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          authType: 'coinbase-embedded',
          walletAddress,
          txHash,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to register user in database');
      }

      const authResponse: AuthResponse = await response.json();

      // Store auth data locally
      this.setAuthData(authResponse);
      return authResponse;
    } catch (error) {
      console.error('[AuthService] Failed to register with embedded wallet:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to register with embedded wallet');
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

    // External wallet registration
    if (data.authType === 'wallet' && data.walletAddress) {
      try {
        // Step 1: Register email on blockchain contract
        const txHash = await writeContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'registerEmail',
          args: [data.email]
        });

        console.log('Blockchain registration successful:', txHash);

        // Step 2: Register user in backend database
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            authType: 'wallet',
            walletAddress: data.walletAddress,
            signature: data.signature,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to register user in database');
        }

        const authResponse: AuthResponse = await response.json();

        // Store auth data locally
        this.setAuthData(authResponse);
        return authResponse;
      } catch (error) {
        console.error('Failed to register user:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to register user in database');
      }
    }

    throw new Error('Invalid registration data');
  }

  async login(data: LoginData): Promise<AuthResponse> {
    console.log('[AuthService] login called with:', data.authType);

    // Handle wallet authentication
    if (data.authType === 'wallet') {
      console.log('[AuthService] Wallet auth detected, using loginWithWallet');
      if (!data.email) {
        throw new Error('Email is required for wallet login');
      }
      // For embedded wallets, we don't have a signature yet, so we'll use the wallet address
      // The backend should handle embedded wallet login differently
      return this.loginWithWallet(data.email, data.signature || '', data.signature || '');
    }

    console.error('[AuthService] Invalid login data - no valid auth type');
    throw new Error('Invalid login data');
  }

  async loginWithWallet(email: string, walletAddress: string, signature: string): Promise<AuthResponse> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

    console.log('[AuthService] loginWithWallet called with:', { email, walletAddress, hasSignature: !!signature });

    try {
      console.log('[AuthService] Sending login request to:', `${API_BASE_URL}/auth/login`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          signature,
          authType: 'wallet',
        }),
      });

      console.log('[AuthService] Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[AuthService] Login failed with error:', errorData);
        throw new Error(errorData.error || 'Wallet login failed');
      }

      const authResponse: AuthResponse = await response.json();
      console.log('[AuthService] Login successful, setting auth data');
      this.setAuthData(authResponse);
      return authResponse;
    } catch (error) {
      console.error('[AuthService] Wallet login failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wallet login failed');
    }
  }

  async getChallenge(email: string): Promise<ChallengeResponse> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

    try {
      const response = await fetch(`${API_BASE_URL}/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        // Fallback to local challenge if backend is unavailable
        console.warn('Backend challenge endpoint unavailable, using local challenge');
        return {
          nonce: `Login to DexMail: ${Date.now()}`,
          expires: Date.now() + 3600000
        };
      }

      return await response.json();
    } catch (error) {
      console.warn('Failed to get challenge from backend, using local challenge:', error);
      return {
        nonce: `Login to DexMail: ${Date.now()}`,
        expires: Date.now() + 3600000
      };
    }
  }

  async linkWallet(data: LinkWalletData): Promise<{ success: boolean; user: User }> {
    // Call registerEmail or similar?
    // If email already exists, we might need to transfer ownership?
    // For now, just return success
    if (!this.currentUser) throw new Error('Not logged in');

    this.currentUser.walletAddress = data.walletAddress;
    return { success: true, user: this.currentUser };
  }

  async getProfile(): Promise<User> {
    console.log('[AuthService] getProfile called');
    // Try to restore from localStorage if not in memory
    if (!this.currentUser && typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('auth_user');
      const storedToken = localStorage.getItem('auth_token');

      if (storedUser && storedToken) {
        this.currentUser = JSON.parse(storedUser);
        this.token = storedToken;
        console.log('[AuthService] Restored user from localStorage:', this.currentUser);
      }
    }

    if (!this.currentUser) {
      console.error('[AuthService] No user found in memory or localStorage');
      throw new Error('Not authenticated');
    }

    console.log('[AuthService] Returning user:', this.currentUser);
    return this.currentUser;
  }

  async updateProfile(data: { walletAddress?: string }): Promise<User> {
    if (!this.currentUser) throw new Error('Not logged in');
    if (data.walletAddress) this.currentUser.walletAddress = data.walletAddress;
    return this.currentUser;
  }

  logout() {
    console.log('[AuthService] Logging out and clearing all data');
    this.token = null;
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      // Clear ALL localStorage data for complete cleanup
      localStorage.clear();
      console.log('[AuthService] Cleared all localStorage data');
    }
  }

  getCurrentUser(): User | null {
    if (!this.currentUser && typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth_user');
      if (stored) this.currentUser = JSON.parse(stored);
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('auth_token');
    }
    return !!this.token;
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private setAuthData(authResponse: AuthResponse) {
    this.token = authResponse.token;
    this.currentUser = authResponse.user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', authResponse.token);
      localStorage.setItem('auth_user', JSON.stringify(authResponse.user));
      console.log('[AuthService] Stored auth data for:', authResponse.user.email);
    }
  }
}

export const authService = new AuthService();
export default AuthService;
