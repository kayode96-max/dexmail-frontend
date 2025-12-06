'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CryptoAttachment, type Asset } from './crypto-attachment';
import { Checkbox } from '../ui/checkbox';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mailService } from '@/lib/mail-service';
import { CryptoAsset } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

export function ComposeDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSend = async () => {
    if (!to || !subject || !body) {
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

    setIsLoading(true);

    try {
      const cryptoAssets: CryptoAsset[] = assets.map(a => ({
        type: a.type,
        token: a.contract, // Map contract to token
        amount: a.amount,
        symbol: a.symbol,
        tokenId: a.tokenId
      }));

      const result = await mailService.sendEmail({
        from: user.email, // Use authenticated user's email
        to: to.split(',').map(e => e.trim()),
        subject,
        body,
        cryptoTransfer: cryptoEnabled ? {
          enabled: true,
          assets: cryptoAssets
        } : undefined
      });

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
          description: `${assetsText} transferred directly to ${to}. Transaction hash: ${result.messageId.slice(0, 10)}...`,
        });
      } else if (cryptoEnabled && result.claimCode) {
        // Claim-based transfer for unregistered user
        toast({
          title: "Email Sent with Claim Code!",
          description: `Your message has been sent. Claim code: ${result.claimCode}. The recipient can use this code to claim their assets.`,
        });
      } else {
        // Regular email without crypto
        toast({
          title: "Email Sent!",
          description: "Your message has been sent successfully.",
        });
      }

      setOpen(false);
      // Reset form
      setTo('');
      setSubject('');
      setBody('');
      setCryptoEnabled(false);
      setAssets([]);
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="to" className="text-right">
              To
            </Label>
            <Input
              id="to"
              className="col-span-3"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              Subject
            </Label>
            <Input
              id="subject"
              className="col-span-3"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Type your message here..."
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              id="crypto-enabled"
              checked={cryptoEnabled}
              onCheckedChange={(checked) => setCryptoEnabled(Boolean(checked))}
            />
            <label
              htmlFor="crypto-enabled"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Attach Crypto Assets
            </label>
          </div>
          {cryptoEnabled && (
            <CryptoAttachment assets={assets} onChange={setAssets} />
          )}
        </div>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
