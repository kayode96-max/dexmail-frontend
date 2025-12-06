export interface Token {
    id: string;
    name: string;
    symbol: string;
    logoUrl: string;
    balance: string;
    usdValue: string;
    contractAddress: string;
}

export const tokenService = {
    async getTokens(walletAddress: string): Promise<Token[]> {
        if (!walletAddress) return [];

        try {
            console.log('[TokenService] Fetching tokens for:', walletAddress);
            const response = await fetch(`/api/tokens?address=${walletAddress}`);

            if (!response.ok) {
                console.warn(`[TokenService] API proxy failed: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            return data.tokens || [];

        } catch (error) {
            console.error('[TokenService] Error fetching tokens:', error);
            return [];
        }
    }
};
