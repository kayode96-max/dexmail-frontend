
interface PriceData {
    price: number;
    image: string;
}

interface PriceCache {
    data: PriceData;
    timestamp: number;
}

interface TokenPrices {
    [symbol: string]: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'eth_price_data_cache';
const TOKEN_PRICES_CACHE_KEY = 'token_prices_cache';

// Mapping for normalization
const SYMBOL_TO_ID: Record<string, string> = {
    'ETH': 'ethereum',
    'WETH': 'ethereum',
    'cbETH': 'ethereum',
    'BTC': 'bitcoin',
    'WBTC': 'bitcoin',
    'cbBTC': 'bitcoin',
    'USDC': 'usd-coin',
    'USDbC': 'usd-coin',
    'DAI': 'dai',
    'USDT': 'tether',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'COMP': 'compound-governance-token',
    'SNX': 'havven',
    'YFI': 'yearn-finance',
    'MKR': 'maker',
    'SUSHI': 'sushi',
    'MATIC': 'matic-network',
    'CRV': 'curve-dao-token',
    'BAL': 'balancer',
    'LDO': 'lido-dao',
    'APE': 'apecoin',
    'GRT': 'the-graph',
    '1INCH': '1inch',
    'RPL': 'rocket-pool',
    'GNO': 'gnosis',
    'BAT': 'basic-attention-token',
    'ZRX': '0x',
    'ENJ': 'enjincoin',
    'MANA': 'decentraland',
    'SAND': 'the-sandbox',
    'CHZ': 'chiliz',
    'AXS': 'axie-infinity',
};

export const priceService = {
    async getEthPrice(): Promise<PriceData> {
        // Check in-memory/localStorage cache first
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached) as PriceCache;
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        console.log('[PriceService] Using cached ETH data:', data);
                        return data;
                    }
                }
            } catch (e) {
                console.warn('[PriceService] Failed to read cache', e);
            }
        }

        try {
            console.log('[PriceService] Fetching ETH data from CoinGecko...');
            const response = await fetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum'
            );

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.statusText}`);
            }

            const data = await response.json();
            if (data && data.length > 0) {
                const result: PriceData = {
                    price: data[0].current_price,
                    image: data[0].image
                };

                // Update cache
                if (typeof window !== 'undefined') {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        data: result,
                        timestamp: Date.now()
                    }));
                }
                return result;
            }
            return { price: 0, image: '' };
        } catch (error) {
            console.error('[PriceService] Error fetching ETH data:', error);
            return { price: 0, image: '' };
        }
    },

    async getTokenPrices(symbols: string[]): Promise<TokenPrices> {
        if (symbols.length === 0) return {};

        // Normalize symbols to IDs
        const idsToFetch = new Set<string>();
        const symbolToIdMap: Record<string, string> = {};

        symbols.forEach(symbol => {
            const upperSymbol = symbol.toUpperCase();
            let id = SYMBOL_TO_ID[upperSymbol];

            // Heuristic fallback for BTC and ETH variants
            if (!id) {
                if (upperSymbol.includes('BTC')) {
                    id = 'bitcoin';
                } else if (upperSymbol.includes('ETH')) {
                    id = 'ethereum';
                } else if (upperSymbol.includes('USD')) {
                    id = 'usd-coin';
                }
            }

            if (id) {
                idsToFetch.add(id);
                symbolToIdMap[symbol] = id;
            }
        });

        if (idsToFetch.size === 0) return {};

        const idsString = Array.from(idsToFetch).join(',');

        // Check cache
        // Note: This simple cache might be insufficient if different sets of tokens are requested.
        // For a robust solution, we'd cache per ID. For now, let's just fetch.

        try {
            console.log(`[PriceService] Fetching prices for: ${idsString}`);
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${idsString}&vs_currencies=usd`
            );

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.statusText}`);
            }

            const data = await response.json();
            const prices: TokenPrices = {};

            // Map back to symbols
            symbols.forEach(symbol => {
                const id = symbolToIdMap[symbol];
                if (id && data[id]) {
                    prices[symbol] = data[id].usd;
                }
            });

            return prices;

        } catch (error) {
            console.error('[PriceService] Error fetching token prices:', error);
            return {};
        }
    }
};
