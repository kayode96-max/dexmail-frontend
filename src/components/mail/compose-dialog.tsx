'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSendUserOperation, useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';
import { encodeFunctionData } from 'viem';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatEther } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CryptoAttachment, type Asset } from './crypto-attachment';
import { Checkbox } from '../ui/checkbox';
import { Send, Loader2, Save, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mailService } from '@/lib/mail-service';
import { CryptoAsset } from '@/lib/types';
import { useMail } from '@/contexts/mail-context';
import { EmailTagInput } from '@/components/ui/email-tag-input';
import { FileAttachmentInput, type FileAttachment } from './file-attachment';

export function ComposeDialog({
  children,
  initialData
}: {
  children: React.ReactNode;
  initialData?: { to: string; subject: string; body: string; id?: string };
}) {
  const [open, setOpen] = useState(false);
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody] = useState(initialData?.body || '');

  // Update state when initialData changes or dialog opens
  useEffect(() => {
    if (open && initialData) {
      // Convert comma-separated string to array if needed
      const emails = initialData.to ? initialData.to.split(',').map(e => e.trim()).filter(Boolean) : [];
      setToEmails(emails);
      setSubject(initialData.subject);
      setBody(initialData.body);
    }
  }, [open, initialData]);
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feeConfirmation, setFeeConfirmation] = useState<{
    open: boolean;
    totalFee: bigint;
    details: { email: string; fee: bigint }[];
  }>({ open: false, totalFee: BigInt(0), details: [] });

  const { toast } = useToast();
  const { user } = useAuth();
  const { saveDraft } = useMail();
  const { sendUserOperation } = useSendUserOperation();
  const { currentUser } = useCurrentUser();
  const { isSignedIn } = useIsSignedIn();

  const isPlatformRecipient = toEmails.length > 0 && toEmails.every(email => email.trim().endsWith('@dexmail.app'));

  useEffect(() => {
    if (!isPlatformRecipient && cryptoEnabled) {
      setCryptoEnabled(false);
    }
  }, [isPlatformRecipient, cryptoEnabled]);

  // Load draft if initialData is provided (we'll need to add this prop later if we want to open specific drafts)
  // For now, let's just add the save functionality.

  const handleSaveDraft = () => {
    if (toEmails.length === 0 && !subject && !body) {
      return; // Don't save empty drafts
    }

    const draftId = `draft-${Date.now()}`;
    saveDraft({
      id: draftId,
      to: toEmails.join(', '),
      subject,
      body,
      timestamp: Date.now()
    });

    toast({
      title: "Draft Saved",
      description: "Your email has been saved to drafts.",
    });
    setOpen(false);
  };

  const handleSend = async () => {
    if (toEmails.length === 0 || !subject || !body) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.email) {
      toast({
        title: "Not authenticated",
        description: "Please log in to send emails.",
        variant: "destructive",
      });
      return;
    }

    // Check if any attachments are still uploading
    const uploadingFiles = fileAttachments.filter(f => f.uploading);
    if (uploadingFiles.length > 0) {
      toast({
        title: "Files still uploading",
        description: "Please wait for all attachments to finish uploading.",
        variant: "destructive",
      });
      return;
    }

    // Check if any attachments failed to upload
    const failedFiles = fileAttachments.filter(f => f.error);
    if (failedFiles.length > 0) {
      toast({
        title: "Upload errors",
        description: "Some attachments failed to upload. Please remove them or try again.",
        variant: "destructive",
      });
      return;
    }

    // Validate crypto transfers only work with single recipient
    const normalizedRecipients = toEmails.map(email => {
      const trimmed = email.trim();
      return trimmed;
    });

    if (cryptoEnabled && assets.length > 0 && normalizedRecipients.length > 1) {
      toast({
        title: "Crypto Transfer Limitation",
        description: "Crypto transfers can only be sent to a single recipient. Please remove additional recipients or disable crypto attachment.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    setIsLoading(true);

    try {
      // Step 1: Check required fees (Pay2Contact)
      const feeInfo = await mailService.getRequiredFees(user.email, normalizedRecipients);

      if (feeInfo.totalFee > BigInt(0)) {
        setIsLoading(false);
        setFeeConfirmation({
          open: true,
          totalFee: feeInfo.totalFee,
          details: feeInfo.details
        });
        return;
      }

      await executeSend(normalizedRecipients);

    } catch (error) {
      console.error('Failed to prepare email:', error);
      toast({
        title: "Error",
        description: "Failed to check requirements",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const executeSend = async (recipients: string[]) => {
    if (!user?.email) return;

    // Re-lock loading state if coming from confirmation
    if (!isLoading) setIsLoading(true);

    try {
      // Validate all @dexmail.app addresses before sending
      const dexmailAddresses = recipients.filter(email =>
        email.toLowerCase().endsWith('@dexmail.app')
      );

      if (dexmailAddresses.length > 0) {
        const validationResults = await mailService.validateEmailsBatch(dexmailAddresses);

        const invalidAddresses = dexmailAddresses.filter(email =>
          !validationResults[email]?.isValid
        );

        if (invalidAddresses.length > 0) {
          toast({
            title: "Invalid Recipients",
            description: `The following @dexmail.app addresses do not exist: ${invalidAddresses.join(', ')}`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Validate traditional email domains
      const traditionalEmails = recipients.filter(email =>
        !email.toLowerCase().endsWith('@dexmail.app')
      );

      // We need to import isValidTraditionalEmail from lib/validation first, but since I can't edit imports and code in one go easily without view, I'll use the helper if imported, or just use the logic here if simpler. 
      // Actually, I should check if I imported it. I haven't. 
      // I will assume I need to add the import or use the function if available globally (it's not).
      // Let's modify the import first in a separate step or assume I can do it here? No, better to be safe.
      // I'll add the logic inline or rely on a subsequent step to fix import.
      // WAIT, I can start by adding the import in the `compose-dialog.tsx` file in a previous step?
      // No, I'll do it now. I'll add the check here and then a separate tool call to add the import.

      const { isValidTraditionalEmail } = await import('@/lib/validation');

      const invalidTraditionalEmails = traditionalEmails.filter(email => !isValidTraditionalEmail(email));

      if (invalidTraditionalEmails.length > 0) {
        toast({
          title: "Invalid Email Domains",
          description: `The following email addresses have invalid domains: ${invalidTraditionalEmails.join(', ')}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check CDP authentication for embedded wallet users
      if (user?.authType === 'coinbase-embedded' && !isSignedIn) {
        toast({
          title: "Session Expired",
          description: "Your Coinbase session has expired. Please log in again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const cryptoAssets: CryptoAsset[] = assets.map(a => ({
        type: a.type,
        token: a.contract, // Map contract to token
        amount: a.amount,
        symbol: a.symbol,
        tokenId: a.tokenId
      }));

      // Create transaction callback for embedded wallets
      const sendTx = async (args: { to: string; data: string; value?: bigint }) => {
        const smartAccount = currentUser?.evmSmartAccounts?.[0];
        if (!smartAccount) {
          throw new Error('Smart account not found');
        }

        const result = await sendUserOperation({
          evmSmartAccount: smartAccount,
          network: "base",
          calls: [{
            to: args.to as `0x${string}`,
            data: args.data as `0x${string}`,
            value: args.value ?? BigInt(0),
          }],
          useCdpPaymaster: true  // Enable gasless transactions
        });
        // SendUserOperationResult returns userOperationHash, not transactionHash
        return result.userOperationHash;
      };

      // Normalize recipient emails: lowercase @dexmail.app addresses
      // (already normalized above for validation)

      // Prepare file attachments data
      const attachmentsData = fileAttachments
        .filter(f => f.cid) // Only include successfully uploaded files
        .map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
          cid: f.cid!,
        }));

      const result = await mailService.sendEmail(
        {
          from: user.email, // Use authenticated user's email
          to: recipients,
          subject,
          body,
          attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
          cryptoTransfer: cryptoEnabled ? {
            enabled: true,
            assets: cryptoAssets
          } : undefined
        },
        user?.authType, // Pass auth type
        user?.authType === 'coinbase-embedded' ? sendTx : undefined // Pass transaction callback for embedded wallets
      );

      // Show different success messages based on transfer type
      if (cryptoEnabled && result.isDirectTransfer) {
        // Direct transfer to registered user
        const assetsText = cryptoAssets.map(a => {
          if (a.type === 'eth') return `${a.amount} ETH`;
          if (a.type === 'erc20') return `${a.amount} ${a.symbol || 'tokens'}`;
          if (a.type === 'nft') return `NFT #${a.tokenId}`;
          return 'assets';
        }).join(', ');

        toast({
          title: "Email & Crypto Sent!",
          description: `${assetsText} transferred directly to ${toEmails.join(', ')}. Transaction hash: ${result.messageId.slice(0, 10)}...`,
        });
      } else if (cryptoEnabled && result.claimCode) {
        // Claim-based transfer for unregistered user
        toast({
          title: "Email Sent with Claim Code!",
          description: `Your message has been sent. Claim code: ${result.claimCode}. The recipient can use this code to claim their assets.`,
        });
      } else {
        // Regular email without crypto - show recipient count for bulk sends
        const recipientCount = recipients.length;
        toast({
          title: "Email Sent!",
          description: recipientCount > 1
            ? `Your message has been sent to ${recipientCount} recipients successfully.`
            : "Your message has been sent successfully.",
        });
      }

      setOpen(false);
      // Reset form
      setToEmails([]);
      setSubject('');
      setBody('');
      setCryptoEnabled(false);
      setAssets([]);
      setFileAttachments([]);
      setShowAttachments(false);
    } catch (error) {
      console.error('Failed to send email:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmFee = () => {
    setFeeConfirmation(prev => ({ ...prev, open: false }));
    executeSend(toEmails);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Compose a new email to send to another user. You can also attach crypto assets.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="to">To</Label>
            <EmailTagInput
              emails={toEmails}
              onChange={setToEmails}
              placeholder="recipient@example.com"
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">
              Subject
            </Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Type your message here..."
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {/* File Attachments Section */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => setShowAttachments(!showAttachments)}
              disabled={isLoading}
            >
              <span className="flex items-center">
                <Paperclip className="mr-2 h-4 w-4" />
                Attachments {fileAttachments.length > 0 && `(${fileAttachments.length})`}
              </span>
              {showAttachments ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {showAttachments && (
              <FileAttachmentInput
                attachments={fileAttachments}
                onChange={setFileAttachments}
                disabled={isLoading}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="crypto-enabled"
                checked={cryptoEnabled}
                onCheckedChange={(checked) => setCryptoEnabled(Boolean(checked))}
                disabled={!isPlatformRecipient}
              />
              <label
                htmlFor="crypto-enabled"
                className={`text-sm font-medium leading-none ${!isPlatformRecipient ? 'text-slate-400 cursor-not-allowed' : 'peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                  }`}
              >
                Attach Crypto Assets
              </label>
            </div>
            {!isPlatformRecipient && toEmails.length > 0 && (
              <p className="text-xs text-amber-600 ml-6">
                Crypto attachments are currently only available for @dexmail.app recipients.
                <br />
                <span className="opacity-75">Cross-Platform transfers coming soon.</span>
              </p>
            )}
          </div>
          {cryptoEnabled && (
            <CryptoAttachment assets={assets} onChange={setAssets} />
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleSaveDraft} disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>Cancel</Button>
            <Button type="submit" onClick={handleSend} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send {cryptoEnabled && assets.length > 0 && '+ Transfer Crypto'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>

        <AlertDialog open={feeConfirmation.open} onOpenChange={(open) => setFeeConfirmation(prev => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pay2Contact Fee Required</AlertDialogTitle>
              <AlertDialogDescription>
                Some recipients require a fee to be contacted because you are not on their whitelist.
              </AlertDialogDescription>
              <div className="pt-2">
                <p className="font-semibold mb-2">Total Fee: {formatEther(feeConfirmation.totalFee)} ETH</p>
                <div className="text-sm border rounded-md p-2 bg-slate-50 text-slate-900 max-h-32 overflow-y-auto">
                  {feeConfirmation.details.map((d, i) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{d.email}</span>
                      <span className="font-mono text-xs">{formatEther(d.fee)} ETH</span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsLoading(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmFee}>Pay & Send</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
}
