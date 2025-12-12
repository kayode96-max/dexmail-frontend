'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Wallet, Loader2 } from "lucide-react";
import Image from "next/image";
import { useAccount, useBalance } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { useEffect, useState } from "react";
import { priceService } from "@/lib/price-service";
import { nftService, NFT } from "@/lib/nft-service";
import { tokenService } from "@/lib/token-service";
import { useAuth } from "@/contexts/auth-context";



function NFTGallery({ nfts }: { nfts: NFT[] }) {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  // Group NFTs by collection
  const collections = nfts.reduce((acc, nft) => {
    const collectionName = nft.collection || 'Unknown Collection';
    if (!acc[collectionName]) {
      acc[collectionName] = [];
    }
    acc[collectionName].push(nft);
    return acc;
  }, {} as Record<string, NFT[]>);

  const collectionNames = Object.keys(collections);

  if (selectedCollection) {
    const collectionNfts = collections[selectedCollection] || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" onClick={() => setSelectedCollection(null)} className="pl-0 hover:pl-2 transition-all">
            ← Back to Collections
          </Button>
          <h3 className="text-xl font-semibold">{selectedCollection}</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {collectionNfts.map(nft => (
            <Card key={nft.id} className="overflow-hidden group">
              <div className="aspect-square relative">
                <Image
                  src={nft.imageUrl}
                  alt={nft.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  data-ai-hint={nft.imageHint}
                />
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-base truncate">{nft.name}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {collectionNames.map(name => {
        const firstNft = collections[name][0];
        const count = collections[name].length;
        return (
          <Card
            key={name}
            className="overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedCollection(name)}
          >
            <div className="aspect-square relative">
              <Image
                src={firstNft.imageUrl}
                alt={name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white font-semibold">View Collection</span>
              </div>
            </div>
            <CardHeader className="p-4">
              <CardTitle className="text-base truncate">{name}</CardTitle>
              <CardDescription>{count} {count === 1 ? 'Item' : 'Items'}</CardDescription>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { user } = useAuth();

  // Prioritize user.walletAddress for embedded wallets, fall back to wagmi for external wallets
  const address = (user?.walletAddress || wagmiAddress) as `0x${string}` | undefined;
  const isConnected = !!address;

  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address: address,
  });
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [ethImage, setEthImage] = useState<string>("");


  // Fetch Price & Image
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceData = await priceService.getEthPrice();
        setEthPrice(priceData.price);
        setEthImage(priceData.image);
      } catch (error) {
        console.error('[ProfilePage] Error fetching price:', error);
      }
    };
    fetchPrice();
  }, []);

  // Fetch NFTs using useQuery
  const { data: nfts = [], isLoading: isLoadingNfts } = useQuery({
    queryKey: ['nfts', address],
    queryFn: async () => {
      if (!address) return [];
      console.log('[ProfilePage] Fetching NFTs for:', address);
      return await nftService.getNfts(address);
    },
    enabled: !!address,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const ethBalanceStr = balanceData ? formatEther(balanceData.value) : "0";
  const ethBalanceNum = parseFloat(ethBalanceStr);
  const usdValue = (ethBalanceNum * ethPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Fetch Tokens using useQuery
  const { data: tokens = [], isLoading: isLoadingTokens } = useQuery({
    queryKey: ['tokens', address],
    queryFn: async () => {
      if (!address) return [];
      console.log('[ProfilePage] Fetching Tokens for:', address);
      return await tokenService.getTokens(address);
    },
    enabled: !!address,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch Token Prices
  const { data: tokenPrices = {} } = useQuery({
    queryKey: ['tokenPrices', tokens],
    queryFn: async () => {
      if (tokens.length === 0) return {};
      const symbols = tokens.map(t => t.symbol);
      return await priceService.getTokenPrices(symbols);
    },
    enabled: tokens.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Combine ETH with other tokens and calculate USD values
  const allTokens = [
    {
      id: "eth",
      name: "Ethereum",
      symbol: "ETH",
      logoUrl: ethImage || "https://i.pravatar.cc/150?u=eth",
      balance: ethBalanceNum.toFixed(4),
      usdValue: usdValue,
      contractAddress: "0x0000000000000000000000000000000000000000"
    },
    ...tokens.map(token => {
      const price = tokenPrices[token.symbol];
      const balance = parseFloat(token.balance);
      const value = price ? balance * price : 0;
      return {
        ...token,
        usdValue: value > 0 ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00'
      };
    })
  ];

  // Calculate Total Balance
  const totalBalance = allTokens.reduce((acc, token) => {
    const price = tokenPrices[token.symbol] || (token.symbol === 'ETH' ? ethPrice : 0);
    const balance = parseFloat(token.balance);
    return acc + (balance * price);
  }, 0);

  const totalBalanceStr = totalBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (!isConnected) {
    return (
      <div className="flex-1 p-8 pt-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground">Please connect your wallet to view your portfolio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Portfolio</h2>
        <div className="flex items-center space-x-2">
          <Button>
            <ArrowUp className="mr-2 h-4 w-4" /> Send
          </Button>
          <Button variant="outline">
            <ArrowDown className="mr-2 h-4 w-4" /> Receive
          </Button>
        </div>
      </div>

      <Card className="relative overflow-hidden bg-primary/20 backdrop-blur-md border-primary/30">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 -z-10"></div>
        <CardHeader>
          <CardDescription className="text-primary-foreground/80">Total Balance</CardDescription>
          <CardTitle className="text-4xl md:text-5xl font-bold text-primary-foreground">
            {isBalanceLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              totalBalanceStr
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-primary-foreground/80">
            <Wallet className="mr-2 h-4 w-4" />
            <span className="font-mono">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tokens" className="space-y-4">
        <TabsList className="rounded-full">
          <TabsTrigger value="tokens" className="data-[state=active]:rounded-full">Tokens</TabsTrigger>
          <TabsTrigger value="nfts" className="data-[state=active]:rounded-full">NFTs</TabsTrigger>
        </TabsList>
        <TabsContent value="tokens" className="space-y-4">
          {isLoadingTokens ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1">
              {allTokens.map(token => (
                <Card key={token.id} className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarImage src={token.logoUrl} alt={token.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{token.symbol.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-base">{token.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{token.symbol}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-base">
                        {token.usdValue !== '$0.00' ? token.usdValue : `${parseFloat(token.balance).toFixed(4)} ${token.symbol}`}
                      </div>
                      {token.usdValue !== '$0.00' && (
                        <div className="text-sm text-muted-foreground">
                          {parseFloat(token.balance).toFixed(4)} {token.symbol}
                        </div>
                      )}
                    </div>
                  </div>

                  {token.contractAddress !== "0x0000000000000000000000000000000000000000" && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-md shadow-sm">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering other clicks if we add them later
                        navigator.clipboard.writeText(token.contractAddress);
                      }}>
                        <span className="sr-only">Copy Address</span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                        >
                          <path
                            d="M1 9.50006C1 10.3285 1.67157 11.0001 2.5 11.0001H4L4 10.0001H2.5C2.22386 10.0001 2 9.7762 2 9.50006L2 2.50006C2 2.22392 2.22386 2.00006 2.5 2.00006L9.5 2.00006C9.77614 2.00006 10 2.22392 10 2.50006V4.00006H11V2.50006C11 1.67163 10.3284 1.00006 9.5 1.00006L2.5 1.00006C1.67157 1.00006 1 1.67163 1 2.50006V9.50006ZM5 5.50006C5 4.67163 5.67157 4.00006 6.5 4.00006H12.5C13.3284 4.00006 14 4.67163 14 5.50006V12.5001C14 13.3285 13.3284 14.0001 12.5 14.0001H6.5C5.67157 14.0001 5 13.3285 5 12.5001V5.50006ZM6.5 5.00006C6.22386 5.00006 6 5.22392 6 5.50006V12.5001C6 12.7762 6.22386 13.0001 6.5 13.0001H12.5C12.7761 13.0001 13 12.7762 13 12.5001V5.50006C13 5.22392 12.7761 5.00006 12.5 5.00006H6.5Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="nfts" className="space-y-4">
          {isLoadingNfts ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : nfts.length > 0 ? (
            <NFTGallery nfts={nfts} />
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              No NFTs found in this wallet on Base Sepolia.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
