import { NextRequest, NextResponse } from 'next/server';
import { getPlaceholderImage } from '@/lib/placeholder';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    try {
        console.log('[API] Fetching NFTs for:', walletAddress);

        // Alchemy API for Base Sepolia
        const apiKey = process.env.ALCHEMY_API_KEY || 'demo'; // Fallback to demo or empty
        const baseURL = `https://base-sepolia.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`;
        const url = `${baseURL}?owner=${walletAddress}&withMetadata=true`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`[API] Alchemy API failed: ${response.status} ${response.statusText}`);
            return NextResponse.json({ nfts: [] });
        }

        const data = await response.json();

        // Map Alchemy response to our NFT interface
        const nfts = (data.ownedNfts || []).map((nft: any) => ({
            id: `${nft.contract.address}-${nft.tokenId}`,
            name: nft.name || `#${nft.tokenId}`,
            collection: nft.contract.name || 'Unknown Collection',
            imageUrl: nft.image.originalUrl || nft.image.thumbnailUrl || nft.image.pngUrl || getPlaceholderImage(),
            imageHint: nft.description || 'NFT Image'
        }));

        return NextResponse.json({ nfts });
    } catch (error) {
        console.error('[API] Error fetching NFTs:', error);
        // Return empty list on failure to avoid breaking UI
        return NextResponse.json({ nfts: [] });
    }
}
