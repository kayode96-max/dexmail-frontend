# Creating Smart Wallets Server-Side for Email/Password Users

## Architecture Overview

Your app has two authentication paths:
1. **Email/Password** → Create Smart Wallet server-side (this guide)
2. **Wallet Connection** → Users connect existing wallets via RainbowKit

This guide focuses on **creating and managing Smart Wallets server-side** using the Coinbase CDP SDK when users sign up with email/password.

---

## Step 1: Install CDP SDK (Backend)

Install the Coinbase CDP SDK on your backend:

```bash
npm install @coinbase/cdp-sdk viem
# or
yarn add @coinbase/cdp-sdk viem
# or
pnpm add @coinbase/cdp-sdk viem
```

---

## Step 2: Get CDP API Credentials

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Create a new project
3. Generate API credentials:
   - **CDP API Key Name**
   - **CDP API Key Secret**
   - **Wallet Secret** (for encrypting wallet data)

4. Save these to your `.env` file:

```bash
# .env
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret
CDP_WALLET_SECRET=your-wallet-secret

# Database connection
DATABASE_URL=your-database-url

# Optional: Paymaster for gas sponsorship (get from CDP Portal)
CDP_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base/YOUR_API_KEY
```

---

## Step 3: Initialize CDP Client

Create a CDP client singleton:

```typescript
// lib/cdp-client.ts
import { CdpClient } from '@coinbase/cdp-sdk';

let cdpClient: CdpClient | null = null;

export function initializeCdpClient(): CdpClient {
  if (cdpClient) return cdpClient;

  cdpClient = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_NAME!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
  });

  return cdpClient;
}

export function getCdpClient(): CdpClient {
  if (!cdpClient) {
    throw new Error('CDP Client not initialized. Call initializeCdpClient() first.');
  }
  return cdpClient;
}
```

Initialize it when your server starts:

```typescript
// app.ts or server.ts
import { initializeCdpClient } from './lib/cdp-client';

// Initialize CDP on server startup
initializeCdpClient();
```

---

## Step 4: Database Schema

You need to store wallet data for each user. Here's a sample schema:

```sql
-- PostgreSQL example
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE smart_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  owner_private_key_encrypted TEXT NOT NULL, -- Encrypted!
  network VARCHAR(50) DEFAULT 'base-sepolia',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, network)
);

CREATE INDEX idx_smart_wallets_user_id ON smart_wallets(user_id);
CREATE INDEX idx_smart_wallets_address ON smart_wallets(wallet_address);
```

**Important:** Never store private keys in plaintext. Always encrypt them!

---

## Step 5: Create Smart Wallet on User Registration

### Backend API Route (Next.js API Route Example)

```typescript
// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import { getCdpClient } from '@/lib/cdp-client';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSmartWallet } from '@coinbase/cdp-sdk';
import { encrypt } from '@/lib/encryption'; // You need to implement this
import { db } from '@/lib/database'; // Your database client

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // 1. Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // 2. Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // 3. Hash password
    const passwordHash = await hash(password, 10);

    // 4. Create Smart Wallet
    const cdp = getCdpClient();
    
    // Generate a new private key for the wallet owner
    const privateKey = generatePrivateKey();
    const owner = privateKeyToAccount(privateKey);
    
    // Create the smart wallet
    const smartWallet = await createSmartWallet({ signer: owner });
    
    // Get the smart wallet address
    const walletAddress = smartWallet.address;

    // 5. Encrypt the private key before storing
    const encryptedPrivateKey = encrypt(privateKey, process.env.CDP_WALLET_SECRET!);

    // 6. Store user and wallet in database (transaction)
    const user = await db.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      // Create smart wallet entry
      await tx.smartWallet.create({
        data: {
          userId: newUser.id,
          walletAddress,
          ownerPrivateKeyEncrypted: encryptedPrivateKey,
          network: 'base-sepolia', // or 'base-mainnet'
        },
      });

      return newUser;
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      walletAddress,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
```

---

## Step 6: Encryption Helper

**CRITICAL:** Never store private keys in plaintext!

```typescript
// lib/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string, secret: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine salt + iv + authTag + encrypted
  return Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]).toString('base64');
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string, secret: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}
```

---

## Step 7: Retrieve Smart Wallet for Authenticated User

When a user logs in, you need to retrieve their smart wallet to perform transactions:

```typescript
// lib/smart-wallet.ts
import { getCdpClient } from './cdp-client';
import { privateKeyToAccount } from 'viem/accounts';
import { toSmartWallet } from '@coinbase/cdp-sdk';
import { decrypt } from './encryption';
import { db } from './database';

export async function getUserSmartWallet(userId: string) {
  // 1. Get wallet data from database
  const walletData = await db.smartWallet.findFirst({
    where: {
      userId,
      network: 'base-sepolia', // or base-mainnet
    },
  });

  if (!walletData) {
    throw new Error('Smart wallet not found for user');
  }

  // 2. Decrypt the private key
  const privateKey = decrypt(
    walletData.ownerPrivateKeyEncrypted,
    process.env.CDP_WALLET_SECRET!
  );

  // 3. Recreate the owner account
  const owner = privateKeyToAccount(privateKey as `0x${string}`);

  // 4. Recreate the smart wallet
  const smartWallet = toSmartWallet({
    smartWalletAddress: walletData.walletAddress as `0x${string}`,
    signer: owner,
  });

  return smartWallet;
}
```

---

## Step 8: Send Transactions (with Gas Sponsorship)

Now you can send transactions on behalf of users:

```typescript
// app/api/wallet/send-transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSmartWallet } from '@/lib/smart-wallet';
import { parseEther } from 'viem';
import { getSession } from '@/lib/auth'; // Your auth helper

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get transaction details
    const { to, amount } = await req.json();

    // 3. Get user's smart wallet
    const smartWallet = await getUserSmartWallet(session.userId);

    // 4. Send transaction with gas sponsorship
    const userOperation = await smartWallet.sendUserOperation({
      calls: [
        {
          to: to as `0x${string}`,
          value: parseEther(amount),
          data: '0x',
        },
      ],
      chainId: 84532, // Base Sepolia (or 8453 for Base Mainnet)
      paymasterURL: process.env.CDP_PAYMASTER_URL, // Optional: for gas sponsorship
    });

    return NextResponse.json({
      success: true,
      transactionHash: userOperation.hash,
      message: 'Transaction sent successfully',
    });
  } catch (error) {
    console.error('Transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to send transaction' },
      { status: 500 }
    );
  }
}
```

---

## Step 9: Interact with Smart Contracts

Example: Minting an NFT

```typescript
// app/api/wallet/mint-nft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSmartWallet } from '@/lib/smart-wallet';
import { encodeFunctionData } from 'viem';
import { getSession } from '@/lib/auth';

const NFT_CONTRACT_ADDRESS = '0x...';
const NFT_ABI = [
  {
    inputs: [{ name: 'to', type: 'address' }],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's smart wallet
    const smartWallet = await getUserSmartWallet(session.userId);

    // Encode the mint function call
    const data = encodeFunctionData({
      abi: NFT_ABI,
      functionName: 'mint',
      args: [smartWallet.address],
    });

    // Send the transaction
    const userOperation = await smartWallet.sendUserOperation({
      calls: [
        {
          to: NFT_CONTRACT_ADDRESS,
          value: 0n,
          data,
        },
      ],
      chainId: 84532,
      paymasterURL: process.env.CDP_PAYMASTER_URL,
    });

    return NextResponse.json({
      success: true,
      transactionHash: userOperation.hash,
    });
  } catch (error) {
    console.error('Mint error:', error);
    return NextResponse.json({ error: 'Failed to mint NFT' }, { status: 500 });
  }
}
```

---

## Step 10: Frontend Integration

On the frontend, you just call your backend APIs:

```typescript
// components/SendTransaction.tsx
'use client';

import { useState } from 'react';

export function SendTransaction() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/wallet/send-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, amount }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Transaction sent! Hash: ' + data.transactionHash);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to send transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Send ETH</h2>
      <input
        type="text"
        placeholder="Recipient address"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <input
        type="text"
        placeholder="Amount (ETH)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Sending...' : 'Send Transaction'}
      </button>
    </div>
  );
}
```

---

## Step 11: Get Wallet Balance

```typescript
// app/api/wallet/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get wallet address from database
    const wallet = await db.smartWallet.findFirst({
      where: { userId: session.userId },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Create public client to read balance
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const balance = await publicClient.getBalance({
      address: wallet.walletAddress as `0x${string}`,
    });

    return NextResponse.json({
      address: wallet.walletAddress,
      balance: balance.toString(),
      balanceFormatted: (Number(balance) / 1e18).toFixed(4),
    });
  } catch (error) {
    console.error('Balance error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance' },
      { status: 500 }
    );
  }
}
```

---

## Step 12: Batch Transactions

One of the best features of Smart Wallets is batch transactions:

```typescript
// app/api/wallet/batch-transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSmartWallet } from '@/lib/smart-wallet';
import { parseEther } from 'viem';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Array of recipients and amounts
    const { transfers } = await req.json();
    // transfers = [{ to: '0x...', amount: '0.001' }, ...]

    const smartWallet = await getUserSmartWallet(session.userId);

    // Build batch calls
    const calls = transfers.map((transfer: any) => ({
      to: transfer.to as `0x${string}`,
      value: parseEther(transfer.amount),
      data: '0x' as const,
    }));

    // Send all in one transaction!
    const userOperation = await smartWallet.sendUserOperation({
      calls, // Multiple calls in one transaction
      chainId: 84532,
      paymasterURL: process.env.CDP_PAYMASTER_URL,
    });

    return NextResponse.json({
      success: true,
      transactionHash: userOperation.hash,
      transfersCount: transfers.length,
    });
  } catch (error) {
    console.error('Batch transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch transfer' },
      { status: 500 }
    );
  }
}
```

---

## Complete Flow Diagram

```
User Signs Up with Email/Password
            ↓
Backend creates Smart Wallet
            ↓
Encrypts & stores private key in DB
            ↓
Returns wallet address to user
            ↓
User logs in
            ↓
Backend retrieves encrypted key
            ↓
Decrypts key & recreates Smart Wallet
            ↓
User can now send transactions
            ↓
Backend sponsors gas (optional)
            ↓
Transaction executed on Base
```

---

## Security Best Practices

### 1. **Encryption**
- ✅ Always encrypt private keys before storing
- ✅ Use AES-256-GCM or similar
- ✅ Use strong, unique encryption keys (not user passwords!)

### 2. **Key Management**
- ✅ Store `CDP_WALLET_SECRET` in secure environment variables
- ✅ Never commit secrets to Git
- ✅ Consider using AWS KMS, Google Secret Manager, or HashiCorp Vault

### 3. **Rate Limiting**
- ✅ Implement rate limits on transaction endpoints
- ✅ Prevent abuse of gas sponsorship

### 4. **Monitoring**
- ✅ Log all wallet operations
- ✅ Set up alerts for suspicious activity
- ✅ Monitor gas spending if sponsoring transactions

### 5. **Database Security**
- ✅ Use connection pooling
- ✅ Implement proper access controls
- ✅ Regular backups of wallet data

### 6. **Session Management**
- ✅ Use secure session tokens
- ✅ Implement session expiration
- ✅ Validate user authentication on every wallet operation

---

## Testing

### Test on Base Sepolia First

```typescript
// Test wallet creation
const testUser = {
  email: 'test@example.com',
  password: 'SecurePassword123!',
};

// 1. Register user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify(testUser),
});

const { walletAddress } = await registerResponse.json();
console.log('Wallet created:', walletAddress);

// 2. Fund wallet using Base Sepolia faucet
// Visit: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

// 3. Send test transaction
const sendResponse = await fetch('/api/wallet/send-transaction', {
  method: 'POST',
  body: JSON.stringify({
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '0.0001',
  }),
});
```

---

## Advantages of This Approach

✅ **Web2 UX** - Users just sign up with email/password
✅ **Gas Sponsorship** - You can pay gas fees for users
✅ **Batch Transactions** - Send multiple operations at once
✅ **No Seed Phrases** - Users never see private keys
✅ **Account Recovery** - You control recovery since you manage keys
✅ **Multichain Ready** - Same wallet works on Base, Ethereum, etc.

---

## When Users Connect External Wallets

For users who choose wallet connection (RainbowKit), you can still track their address:

```typescript
// When user connects wallet via RainbowKit
const { address } = useAccount(); // From wagmi

// Link to user account
await fetch('/api/wallet/link-external', {
  method: 'POST',
  body: JSON.stringify({ externalAddress: address }),
});
```

Then in your database:

```sql
ALTER TABLE users ADD COLUMN external_wallet_address VARCHAR(42);
```

---

## Summary

This approach gives you:
1. **Server-side Smart Wallet creation** for email/password users
2. **Full control** over wallet operations
3. **Gas sponsorship** capability
4. **Secure key management** with encryption
5. **Compatible with RainbowKit** for wallet connection users

Your app now supports both flows:
- **Email/Password** → Smart Wallet (account abstraction)
- **Wallet Connection** → Traditional wallet via RainbowKit

Both can interact with your Base smart contracts seamlessly!