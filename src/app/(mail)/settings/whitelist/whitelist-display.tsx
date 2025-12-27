'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from '@/lib/contracts';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';
import { encodeFunctionData } from 'viem';
import { useSendUserOperation, useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';
import { useToast } from '@/hooks/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export function WhitelistDisplay({ refreshTrigger }: { refreshTrigger?: number }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { sendUserOperation } = useSendUserOperation();
    const { currentUser } = useCurrentUser();
    const { isSignedIn } = useIsSignedIn();
    const [whitelist, setWhitelist] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRemoving, setIsRemoving] = useState<string | null>(null);

    const fetchWhitelist = async () => {
        if (!user?.email) return;
        console.log('[WhitelistDisplay] Fetching whitelist for:', user.email);
        setIsLoading(true);
        try {
            const list = await readContract(wagmiConfig, {
                address: BASEMAILER_ADDRESS,
                abi: baseMailerAbi,
                functionName: 'getWhitelistedEmails',
                args: [user.email]
            }) as string[];
            console.log('[WhitelistDisplay] Fetched whitelist:', list);
            setWhitelist(list || []);
        } catch (error) {
            console.error('[WhitelistDisplay] Error fetching whitelist:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWhitelist();
    }, [user?.email, refreshTrigger]);

    const handleRemove = async (email: string) => {
        setIsRemoving(email);
        try {
            let hash;

            if (user?.authType === 'coinbase-embedded') {
                if (!isSignedIn) throw new Error("Session expired. Please sign in again.");

                const smartAccount = currentUser?.evmSmartAccounts?.[0];
                if (!smartAccount) throw new Error("Smart account not found");

                const callData = encodeFunctionData({
                    abi: baseMailerAbi,
                    functionName: 'updateWhitelist',
                    args: [[email], false]
                });

                const result = await sendUserOperation({
                    evmSmartAccount: smartAccount,
                    network: "base",
                    calls: [{
                        to: BASEMAILER_ADDRESS as `0x${string}`,
                        data: callData,
                        value: BigInt(0)
                    }],
                    useCdpPaymaster: true
                });
                hash = result.userOperationHash;
            } else {
                hash = await writeContract(wagmiConfig, {
                    address: BASEMAILER_ADDRESS,
                    abi: baseMailerAbi,
                    functionName: 'updateWhitelist',
                    args: [[email], false]
                });
            }

            toast({ title: "Transaction Sent", description: "Removing from whitelist..." });

            // Only wait for receipt for standard txs
            if (hash.startsWith('0x') && user?.authType !== 'coinbase-embedded') {
                // Try catch wait
                try {
                    await waitForTransactionReceipt(wagmiConfig, { hash });
                    fetchWhitelist();
                } catch (e) { console.warn("Wait failed", e); }
            } else {
                // For embedded, just wait a bit or assume checks for validity passed
                setTimeout(() => fetchWhitelist(), 5000);
            }

            toast({ title: "Success", description: "Removal transaction submitted." });

        } catch (error: any) {
            toast({
                title: "Error removing email",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsRemoving(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{whitelist.length} emails allowed</span>
                <Button variant="ghost" size="sm" onClick={fetchWhitelist} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email Address</TableHead>
                            <TableHead className="w-[100px] text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {whitelist.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                                    No emails in whitelist
                                </TableCell>
                            </TableRow>
                        ) : (
                            whitelist.map((email) => (
                                <TableRow key={email}>
                                    <TableCell>{email}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemove(email)}
                                            disabled={isRemoving === email}
                                        >
                                            {isRemoving === email ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
