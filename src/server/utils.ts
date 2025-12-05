import { createPublicClient, createWalletClient, http, parseAbiItem, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { config } from 'dotenv';
import { baseMailerAbi } from '../../contracts/abi';

config(); // Load env vars

// Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_JWT = process.env.PINATA_JWT;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BASEMAILER_ADDRESS as `0x${string}`;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

// Viem Clients
export const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
});

const account = RELAYER_PRIVATE_KEY ? privateKeyToAccount(RELAYER_PRIVATE_KEY) : undefined;

export const walletClient = account ? createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
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
    isExternal: boolean,
    hasCrypto: boolean
) {
    if (!walletClient || !account) throw new Error('Relayer wallet not configured');

    // CID is now a string in the contract
    const originalSender = isExternal ? "sendgrid-inbound" : ""; // Or pass it as an argument?
    // Wait, I need to update the function signature to accept originalSender if I want to pass it correctly.
    // But for now, let's just use the CID string.

    // Actually, I should update the function signature to match the contract.
    // But wait, the previous plan said "Update indexMailOnChain to pass the full CID string and the sender email."
    // So I should update the signature.

    // Let's do a quick fix here to match the plan.
    // But I can't change the signature in this tool call easily if I don't change the caller.
    // The caller is in route.ts.

    // Let's just update the body for now and I will update the signature in the next step properly.
    // Wait, I can update the signature here.

    const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'indexMail',
        args: [cid, recipient, isExternal ? "External Sender" : "", isExternal, hasCrypto]
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
