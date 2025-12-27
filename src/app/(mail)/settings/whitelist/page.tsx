'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { EmailTagInput } from '@/components/ui/email-tag-input';
import { WhitelistDisplay } from './whitelist-display';
import { useToast } from '@/hooks/use-toast';
import { writeContract, readContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from '@/lib/contracts';
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import { useAuth } from '@/contexts/auth-context';
import { useSendUserOperation, useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function WhitelistSettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { sendUserOperation } = useSendUserOperation();
    const { currentUser } = useCurrentUser();
    const { isSignedIn } = useIsSignedIn();

    const [emailsToAdd, setEmailsToAdd] = useState<string[]>([]);
    const [contactFee, setContactFee] = useState<string>('0');
    const [isLoadingFee, setIsLoadingFee] = useState(false);
    const [isSavingFee, setIsSavingFee] = useState(false);
    const [isSavingWhitelist, setIsSavingWhitelist] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch current fee and validate wallet mapping
    useEffect(() => {
        async function checkMappingAndFee() {
            if (!user?.email) return;
            setIsLoadingFee(true);
            try {
                // 1. Get Fee
                const fee = await readContract(wagmiConfig, {
                    address: BASEMAILER_ADDRESS,
                    abi: baseMailerAbi,
                    functionName: 'getContactFee',
                    args: [user.email]
                }) as bigint;

                setContactFee(formatEther(fee));

                // 2. Validate Wallet Mapping
                let currentAddress;
                if (user?.authType === 'coinbase-embedded' && currentUser?.evmSmartAccounts?.[0]) {
                    currentAddress = currentUser.evmSmartAccounts[0];
                } else {
                    const { getAccount } = await import('@wagmi/core');
                    const account = getAccount(wagmiConfig);
                    currentAddress = account.address;
                }

                if (currentAddress) {
                    const mappedEmail = await readContract(wagmiConfig, {
                        address: BASEMAILER_ADDRESS,
                        abi: baseMailerAbi,
                        functionName: 'addressToEmail',
                        args: [currentAddress]
                    }) as string;

                    const ownerOfEmail = await readContract(wagmiConfig, {
                        address: BASEMAILER_ADDRESS,
                        abi: baseMailerAbi,
                        functionName: 'emailOwner',
                        args: [user.email]
                    }) as string;

                    console.log('[Whitelist] Wallet Diagnostics:', {
                        userEmail: user.email,
                        currentAddress,
                        mappedEmailFromContract: mappedEmail,
                        ownerOfEmailInContract: ownerOfEmail,
                        match: mappedEmail === user.email
                    });

                    if (mappedEmail !== user.email) {
                        toast({
                            title: "Wallet Mismatch",
                            description: `Current wallet is not registered owner of ${user.email}. Registered owner: ${ownerOfEmail?.slice(0, 6)}...`,
                            variant: "destructive",
                            duration: 10000
                        });
                    }
                }

            } catch (error) {
                console.error('[Whitelist] Error fetching diagnostics/fee:', error);
            } finally {
                setIsLoadingFee(false);
            }
        }
        checkMappingAndFee();
    }, [user?.email, currentUser, user?.authType]);

    const handleUpdateWhitelist = async (status: boolean) => {
        if (emailsToAdd.length === 0) {
            toast({
                title: "No emails",
                description: "Please add at least one email to update.",
                variant: "destructive"
            });
            return;
        }

        console.log('[Whitelist] Updating whitelist with:', { emailsToAdd, status });

        setIsSavingWhitelist(true);
        try {
            let hash;

            if (user?.authType === 'coinbase-embedded') {
                if (!isSignedIn) throw new Error("Session expired. Please sign in again.");

                const smartAccount = currentUser?.evmSmartAccounts?.[0];
                if (!smartAccount) throw new Error("Smart account not found");

                console.log('[Whitelist] Using embedded wallet:', smartAccount);

                const callData = encodeFunctionData({
                    abi: baseMailerAbi,
                    functionName: 'updateWhitelist',
                    args: [emailsToAdd, status]
                });

                console.log('[Whitelist] Encoded call data:', callData);

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
                console.log('[Whitelist] UserOp submitted:', hash);
            } else {
                hash = await writeContract(wagmiConfig, {
                    address: BASEMAILER_ADDRESS,
                    abi: baseMailerAbi,
                    functionName: 'updateWhitelist',
                    args: [emailsToAdd, status]
                });
                console.log('[Whitelist] Transaction submitted:', hash);
            }

            toast({
                title: "Transaction Sent",
                description: "Updating whitelist...",
            });

            if (hash.startsWith('0x') && user?.authType !== 'coinbase-embedded') {
                // For standard wallets, wait for receipt
                try {
                    await waitForTransactionReceipt(wagmiConfig, { hash: hash as `0x${string}` });
                    console.log('[Whitelist] Transaction confirmed');
                } catch (e) {
                    console.warn('[Whitelist] Wait for receipt failed', e);
                }
            }

            toast({
                title: "Success",
                description: `Successfully submitted update to whitelist.`,
            });

            setEmailsToAdd([]);
            // Trigger refresh in WhitelistDisplay component
            setRefreshTrigger(prev => prev + 1);

            // For embedded wallets (and generally to be safe), trigger multiple refreshes
            // to catch the update as soon as the block is indexed.
            setTimeout(() => {
                console.log('[Whitelist] Refreshing list (attempt 1)');
                setRefreshTrigger(prev => prev + 1);
            }, 2000);

            setTimeout(() => {
                console.log('[Whitelist] Refreshing list (attempt 2)');
                setRefreshTrigger(prev => prev + 1);
            }, 5000);

            setTimeout(() => {
                console.log('[Whitelist] Refreshing list (attempt 3)');
                setRefreshTrigger(prev => prev + 1);
            }, 10000);
        } catch (error: any) {
            console.error('[Whitelist] Error updating whitelist:', error);
            // Check for specific revert reasons safely
            const message = error.message || "Failed to update whitelist";

            if (message.includes('Unauthorized') || message.includes('0x82b42900')) {
                toast({
                    title: "Authorization Error",
                    description: "Your wallet is not authorized. Are you registered?",
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Error",
                    description: message,
                    variant: "destructive"
                });
            }
        } finally {
            setIsSavingWhitelist(false);
        }
    };

    const handleUpdateFee = async () => {
        setIsSavingFee(true);
        try {
            const feeWei = parseEther(contactFee);
            let hash;

            if (user?.authType === 'coinbase-embedded') {
                if (!isSignedIn) throw new Error("Session expired. Please sign in again.");

                const smartAccount = currentUser?.evmSmartAccounts?.[0];
                if (!smartAccount) throw new Error("Smart account not found");

                const callData = encodeFunctionData({
                    abi: baseMailerAbi,
                    functionName: 'setContactFee',
                    args: [feeWei]
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
                    functionName: 'setContactFee',
                    args: [feeWei]
                });
            }

            toast({
                title: "Transaction Sent",
                description: "Updating contact fee...",
            });

            toast({
                title: "Success",
                description: "Contact fee update submitted.",
            });
        } catch (error: any) {
            console.error('Error updating fee:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to update fee",
                variant: "destructive"
            });
        } finally {
            setIsSavingFee(false);
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center gap-4">
                <Link href="/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h2 className="text-3xl font-bold tracking-tight">Whitelist Settings</h2>
            </div>

            <div className="grid gap-6">
                {/* Whitelist Management */}
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Whitelist</CardTitle>
                        <CardDescription>
                            Add emails to your whitelist. Emails from these users will bypass the contact fee.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <Label>Add Emails</Label>
                            <EmailTagInput
                                emails={emailsToAdd}
                                onChange={setEmailsToAdd}
                                placeholder="Type email and press Enter..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => handleUpdateWhitelist(true)}
                                disabled={isSavingWhitelist || emailsToAdd.length === 0}
                            >
                                {isSavingWhitelist && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add to Whitelist
                            </Button>
                        </div>

                        <div className="pt-6 border-t">
                            <Label className="mb-4 block">Current Whitelist</Label>
                            {/* List of whitelisted emails would ideally be fetched here */}
                            <WhitelistDisplay refreshTrigger={refreshTrigger} />
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Fee Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pay-to-Contact Fee</CardTitle>
                        <CardDescription>
                            Set the fee (in ETH) that non-whitelisted users must pay to contact you.
                            Set to 0 to disable fees (but they may be marked as spam).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="fee">Contact Fee (ETH)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    id="fee"
                                    placeholder="0.00"
                                    step="0.001"
                                    min="0"
                                    value={contactFee}
                                    onChange={(e) => setContactFee(e.target.value)}
                                    disabled={isLoadingFee}
                                />
                                <span className="text-sm font-medium">ETH</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleUpdateFee}
                            disabled={isSavingFee || isLoadingFee}
                        >
                            {isSavingFee && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Fee
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
