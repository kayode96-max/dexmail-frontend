import { NextRequest, NextResponse } from 'next/server';
import { getPlaceholderImage } from '@/lib/placeholder';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    try {
        console.log('[API] Fetching Tokens for:', walletAddress);

        const apiKey = process.env.ALCHEMY_API_KEY || 'demo';
        const baseURL = `https://base-sepolia.g.alchemy.com/v2/${apiKey}`;

        // 1. Get Token Balances
        const balancesResponse = await fetch(`${baseURL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "alchemy_getTokenBalances",
                params: [walletAddress]
            })
        });

        if (!balancesResponse.ok) {
            throw new Error(`Alchemy API failed: ${balancesResponse.statusText}`);
        }

        const balancesData = await balancesResponse.json();
        const tokenBalances = balancesData.result.tokenBalances;

        // Filter out zero balances
        const nonZeroBalances = tokenBalances.filter((token: any) => {
            // Convert hex balance to BigInt to check if > 0
            return BigInt(token.tokenBalance) > BigInt(0);
        });

        // 2. Get Metadata for each token
        const tokens = await Promise.all(nonZeroBalances.map(async (token: any) => {
            try {
                const metadataResponse = await fetch(`${baseURL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: 1,
                        jsonrpc: "2.0",
                        method: "alchemy_getTokenMetadata",
                        params: [token.contractAddress]
                    })
                });

                const metadataData = await metadataResponse.json();
                const metadata = metadataData.result;

                // Calculate balance
                const balance = Number(BigInt(token.tokenBalance)) / Math.pow(10, metadata.decimals || 18);

                // Heuristic for fallback icons
                let logoUrl = metadata.logo;
                if (!logoUrl && metadata.symbol) {
                    const upperSymbol = metadata.symbol.toUpperCase();
                    if (upperSymbol.includes('USDC') || upperSymbol.includes('USD')) {
                        logoUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png';
                    } else if (upperSymbol.includes('ETH') || upperSymbol.includes('WETH')) {
                        logoUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
                    } else if (upperSymbol.includes('BTC') || upperSymbol.includes('WBTC')) {
                        logoUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png';
                    }
                }

                return {
                    id: token.contractAddress,
                    name: metadata.name || 'Unknown Token',
                    symbol: metadata.symbol || '???',
                    logoUrl: logoUrl || getPlaceholderImage(metadata.symbol || 'Token'),
                    balance: balance.toFixed(4),
                    usdValue: '$0.00', // Placeholder for now, would need a price API
                    contractAddress: token.contractAddress
                };
            } catch (e) {
                console.error(`Error fetching metadata for ${token.contractAddress}`, e);
                return null;
            }
        }));

        return NextResponse.json({ tokens: tokens.filter(t => t !== null) });

    } catch (error) {
        console.error('[API] Error fetching tokens:', error);
        return NextResponse.json({ tokens: [] });
    }
}
