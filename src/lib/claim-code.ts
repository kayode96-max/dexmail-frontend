/**
 * Claim Code Management Utilities
 * 
 * Handles generation, storage, and validation of 6-digit claim codes
 * for crypto transfers sent via email.
 */

export interface ClaimData {
    code: string;
    txHash: string;
    recipientEmail: string;
    senderEmail: string;
    assets: {
        type: 'eth' | 'erc20' | 'nft';
        token?: string;
        amount?: string;
        symbol?: string;
        tokenId?: string;
    }[];
    timestamp: string;
    isRegisteredUser?: boolean; // Track if recipient was registered at send time
    isDirectTransfer?: boolean; // Track if this was a direct transfer
    walletAddress?: string; // Store recipient's wallet address if known
}

const CLAIM_CODES_KEY = 'dexmail_claim_codes';

/**
 * Generate a random 6-digit numeric claim code
 */
export function generateClaimCode(): string {
    // Generate a random 6-digit number (100000 to 999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Ensure uniqueness by checking existing codes
    const existingCodes = getAllClaimCodes();
    if (existingCodes[code]) {
        // Recursively generate a new code if collision occurs (very rare)
        return generateClaimCode();
    }

    return code;
}

/**
 * Store a claim code mapping in localStorage
 */
export function storeClaimCode(
    code: string,
    txHash: string,
    recipientEmail: string,
    senderEmail: string,
    assets: ClaimData['assets'],
    isRegisteredUser?: boolean,
    isDirectTransfer?: boolean
): void {
    if (typeof window === 'undefined') return;

    const claimData: ClaimData = {
        code,
        txHash,
        recipientEmail,
        senderEmail,
        assets,
        timestamp: new Date().toISOString(),
        isRegisteredUser,
        isDirectTransfer
    };

    const allCodes = getAllClaimCodes();
    allCodes[code] = claimData;

    localStorage.setItem(CLAIM_CODES_KEY, JSON.stringify(allCodes));
    console.log('[ClaimCode] Stored claim code:', code, '→', txHash);
}

/**
 * Retrieve claim data from a claim code
 */
export function getClaimData(code: string): ClaimData | null {
    if (typeof window === 'undefined') return null;

    const allCodes = getAllClaimCodes();
    return allCodes[code] || null;
}

/**
 * Validate a claim code format and check if it exists
 */
export function validateClaimCode(code: string): {
    valid: boolean;
    error?: string;
    data?: ClaimData;
} {
    // Check format: must be exactly 6 digits
    if (!/^\d{6}$/.test(code)) {
        return {
            valid: false,
            error: 'Claim code must be exactly 6 digits'
        };
    }

    // Check if code exists
    const data = getClaimData(code);
    if (!data) {
        return {
            valid: false,
            error: 'Claim code not found or invalid'
        };
    }

    return {
        valid: true,
        data
    };
}

/**
 * Get all claim codes from localStorage
 */
function getAllClaimCodes(): Record<string, ClaimData> {
    if (typeof window === 'undefined') return {};

    const stored = localStorage.getItem(CLAIM_CODES_KEY);
    return stored ? JSON.parse(stored) : {};
}

/**
 * Generate a claim URL with the code as a query parameter
 */
export function getClaimUrl(code: string, baseUrl: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
    return `${baseUrl}/dashboard/claim?code=${code}`;
}

/**
 * Format claim code for display (e.g., "123 456")
 */
export function formatClaimCode(code: string): string {
    if (code.length !== 6) return code;
    return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/**
 * Delete a claim code (e.g., after successful claim)
 */
export function deleteClaimCode(code: string): void {
    if (typeof window === 'undefined') return;

    const allCodes = getAllClaimCodes();
    delete allCodes[code];

    localStorage.setItem(CLAIM_CODES_KEY, JSON.stringify(allCodes));
    console.log('[ClaimCode] Deleted claim code:', code);
}
