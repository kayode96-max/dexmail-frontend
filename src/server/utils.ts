import { createPublicClient, createWalletClient, http, parseAbiItem, stringToHex, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { config } from 'dotenv';
import { baseMailerAbi } from '../../contracts/abi';

config(); // Load env vars

// Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_JWT = process.env.PINATA_JWT;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BASEMAILER_ADDRESS as `0x${string}`;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Multiple RPC endpoints for Base mainnet with fallback support
const baseRpcUrls = [
    // Primary: Alchemy (if API key available)
    ...(ALCHEMY_API_KEY ? [`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`] : []),
    // Official Base RPC
    'https://mainnet.base.org',
    // Ankr public RPC
    'https://rpc.ankr.com/base',
    // PublicNode
    'https://base.publicnode.com',
    // 1RPC
    'https://1rpc.io/base',
    // Blast API public
    'https://base.blastapi.io/17f1a5bb-6ee6-40f2-bba1-03a91d8e3ad8',
    // Blockpi
    'https://base.blockpi.network/v1/rpc/public',
];

// Create fallback transport with multiple RPCs
const transport = fallback(
    baseRpcUrls.map(url => http(url, {
        timeout: 10_000,
        retryCount: 2,
        retryDelay: 1000,
    }))
);

// Viem Clients
export const publicClient = createPublicClient({
    chain: base,
    transport
});

const account = RELAYER_PRIVATE_KEY ? privateKeyToAccount(RELAYER_PRIVATE_KEY) : undefined;

export const walletClient = account ? createWalletClient({
    account,
    chain: base,
    transport
}) : undefined;

// IPFS Upload (Node.js version)
export async function uploadJSONToIPFS(data: any) {
    if (!PINATA_JWT) throw new Error('PINATA_JWT not found');

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PINATA_JWT}`
        },
        body: JSON.stringify({
            pinataContent: data,
            pinataMetadata: {
                name: `email-${Date.now()}`
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.statusText}`);
    }

    return response.json();
}

// Contract Interactions
export async function indexMailOnChain(
    cid: string,
    recipient: string,
    originalSender: string,
    isExternal: boolean,
    hasCrypto: boolean
) {
    if (!walletClient || !account) throw new Error('Relayer wallet not configured');

    const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'indexMail',
        args: [cid, recipient, originalSender, isExternal, hasCrypto]
    });

    return hash;
}

export async function getInboxFromChain(email: string) {
    // This would need to call the contract
    // But since we are in Node.js, we can use publicClient
    const inbox = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getInbox',
        args: [email]
    }) as bigint[];

    return inbox;
}

export async function getMailFromChain(mailId: bigint) {
    const mail = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getMail',
        args: [mailId]
    }) as any;

    return mail;
}
