
'use client';
import DOMPurify from 'isomorphic-dompurify';


import { cn } from '@/lib/utils';

import {
  Archive,
  ArrowLeft,
  Clock,
  Folder,
  Forward,
  MoreVertical,
  Reply,
  ReplyAll,
  Trash,
  Send,
  Mail as MailIcon,
  MailOpen,
  AlertCircle,
} from 'lucide-react';
import { format, isToday } from 'date-fns';

import type { Mail } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useIsMobile } from '@/hooks/use-mobile';
import { Textarea } from '../ui/textarea';
import { useMail } from '@/contexts/mail-context';
import { useEffect, useState } from 'react';
import { ComposeDialog } from './compose-dialog';
import { useToast } from '@/hooks/use-toast';
import { mailService } from '@/lib/mail-service';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import { useSendUserOperation, useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';

interface MailDisplayProps {
  mail: Mail | null;
  onBack?: () => void;
  onNavigateToMail?: (mailId: string) => void;
}

interface ThreadMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  date: Date;
  content: string;
  isLatest: boolean;
  avatarSeed: string;
}

function cleanEmailBody(content: string): string {
  return content
    .replace(/\s*\(?Sent via DexMail - The Decentralized Email Protocol\)?\s*/g, '')
    .trim();
}

function isLikelyHtml(content: string): boolean {
  const trimmed = content.trim();
  // Check if content starts with HTML doctype or html tag
  if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
    return true;
  }
  // Check for common HTML tags - more comprehensive list
  const htmlTagPatterns = [
    '</div>', '</p>', '<br', '</body>', '</table>', '</span>',
    '</h1>', '</h2>', '</h3>', '</h4>', '</h5>', '</h6>',
    '</td>', '</tr>', '</a>', '</img', '</center>',
    'style="', 'class="', '</style>', '</head>',
    '<meta', '<link', '<!--', '</font>', '</b>', '</strong>',
    '</em>', '</i>', '</u>', '</ul>', '</ol>', '</li>',
    'bgcolor=', 'cellpadding=', 'cellspacing='
  ];
  
  // Basic check for HTML tags plus any closing tag pattern
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(trimmed);
  const hasClosingTags = htmlTagPatterns.some(pattern => 
    trimmed.toLowerCase().includes(pattern.toLowerCase())
  );
  
  return hasHtmlTags && hasClosingTags;
}

function parseEmailThread(mail: Mail): ThreadMessage[] {
  const messages: ThreadMessage[] = [];

  // 1. Initial message (the latest one)
  const latestMessage: ThreadMessage = {
    id: mail.id,
    senderName: mail.name,
    senderEmail: mail.email,
    date: new Date(mail.date),
    content: '', // Will be filled
    isLatest: true,
    avatarSeed: mail.name || mail.email
  };


  const threadParts = mail.body.split(/\nOn\s+(.*?)\s+wrote:\n/);

  latestMessage.content = cleanEmailBody(threadParts[0]);
  messages.push(latestMessage);

  for (let i = 1; i < threadParts.length; i += 2) {
    const headerInfo = threadParts[i];
    let content = threadParts[i + 1];

    if (!content) continue;

    content = content.replace(/^>\s?/gm, '').trim();
    content = cleanEmailBody(content);

    let senderName = "Unknown";
    let senderEmail = "";
    let dateStr = "";

    const emailMatch = headerInfo.match(/<(.*?)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1];
      senderName = headerInfo.substring(headerInfo.lastIndexOf(',', headerInfo.indexOf('<')) + 1, headerInfo.indexOf('<')).trim();
      if (!senderName) {
        const parts = headerInfo.split(',');
        senderName = parts[parts.length - 1].split('<')[0].trim();
      }
      dateStr = headerInfo.substring(0, headerInfo.indexOf(senderName) || headerInfo.length).trim();
      if (dateStr.endsWith(',')) dateStr = dateStr.slice(0, -1);

    } else {
      const parts = headerInfo.split(',');
      if (parts.length > 2) {
        senderName = parts[parts.length - 1].trim();
        dateStr = parts.slice(0, parts.length - 1).join(',').trim();
      } else {
        dateStr = headerInfo;
      }
    }

    messages.push({
      id: `${mail.id}-history-${i}`,
      senderName: senderName || "Previous Sender",
      senderEmail: senderEmail,
      date: new Date(dateStr) || new Date(),
      content: content,
      isLatest: false,
      avatarSeed: senderName || senderEmail || `user-${i}`
    });
  }

  return messages;
}

export function MailDisplay({ mail, onBack, onNavigateToMail }: MailDisplayProps) {
  const isMobile = useIsMobile();
  const { markAsRead, markAsUnread, moveToArchive, moveToSpam, moveToTrash, restoreFromTrash, getEmailStatus, removeFromArchive } = useMail();
  const { toast } = useToast();
  const { user } = useAuth();
  const [replyBody, setReplyBody] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Coinbase CDP hooks for embedded wallet
  const { sendUserOperation } = useSendUserOperation();
  const { currentUser } = useCurrentUser();
  const { isSignedIn } = useIsSignedIn();

  if (!mail) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <div className="text-lg font-semibold mb-2">No message selected</div>
        <p className="text-sm">Choose a message from the list to view it here</p>
      </div>
    );
  }

  const emailStatus = getEmailStatus(mail.id);

  const handleMarkAsRead = () => {
    if (emailStatus.read) {
      markAsUnread(mail.id);
    } else {
      markAsRead(mail.id);
    }
  };

  const handleArchive = () => {
    moveToArchive(mail.id);
    if (onBack) onBack();
  };

  const handleSpam = () => {
    moveToSpam(mail.id);
    if (onBack) onBack();
  };

  const handleDelete = () => {
    moveToTrash(mail.id);
    if (onBack) onBack();
  };

  useEffect(() => {
    if (mail && !emailStatus.read) {
      const timer = setTimeout(() => {
        markAsRead(mail.id);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mail?.id]);

  const userAvatar = PlaceHolderImages.find(
    (img: any) => img.id === 'user-avatar-1'
  );

  const mailDate = new Date(mail.date);

  const handleReply = async () => {
    if (!replyBody.trim()) {
      toast({
        title: "Empty Reply",
        description: "Please type a message to reply.",
        variant: "destructive"
      });
      return;
    }

    if (!user?.email) {
      toast({
        title: "Authentication Required",
        description: "Please log in to reply.",
        variant: "destructive"
      });
      return;
    }

    if (user?.authType === 'coinbase-embedded' && !isSignedIn) {
      toast({
        title: "Session Expired",
        description: "Your Coinbase session has expired. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReply(true);
    try {
      const fullBody = `${replyBody}\n\nOn ${format(mailDate, "PPP p")}, ${mail.name} wrote:\n> ${cleanEmailBody(mail.body).replace(/\n/g, '\n> ')}`;

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
          useCdpPaymaster: true
        });
        return result.userOperationHash;
      };

      await mailService.sendEmail(
        {
          from: user.email,
          to: [mail.email],
          subject: mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`,
          body: fullBody,
          inReplyTo: mail.id
        },
        user?.authType,
        user?.authType === 'coinbase-embedded' ? sendTx : undefined
      );

      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully."
      });

      setReplyBody('');
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast({
        title: "Error Sending Reply",
        description: "Failed to send your reply. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const getForwardData = () => {
    return {
      to: '',
      subject: mail.subject.startsWith('Fwd:') ? mail.subject : `Fwd: ${mail.subject}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${mail.name} <${mail.email}>\nDate: ${format(mailDate, "PPP p")}\nSubject: ${mail.subject}\nTo: Me\n\n${cleanEmailBody(mail.body)}`
    };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center p-2 md:p-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <div className="flex items-center gap-1 md:gap-2">
          <TooltipProvider delayDuration={0}>
            {emailStatus.deleted ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => {
                    restoreFromTrash(mail.id);
                    if (onBack) onBack();
                  }}>
                    <Reply className="h-4 w-4" />
                    <span className="sr-only">Restore</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore from Trash</TooltipContent>
              </Tooltip>
            ) : emailStatus.archived ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => {
                    removeFromArchive(mail.id);
                    if (onBack) onBack();
                  }}>
                    <Reply className="h-4 w-4" />
                    <span className="sr-only">Restore</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore from Archive</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleMarkAsRead}>
                      {emailStatus.read ? <MailOpen className="h-4 w-4" /> : <MailIcon className="h-4 w-4" />}
                      <span className="sr-only">{emailStatus.read ? 'Mark as Unread' : 'Mark as Read'}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{emailStatus.read ? 'Mark as Unread' : 'Mark as Read'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleArchive}>
                      <Archive className="h-4 w-4" />
                      <span className="sr-only">Archive</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Archive</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleSpam}>
                      <AlertCircle className="h-4 w-4" />
                      <span className="sr-only">Mark as Spam</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as Spam</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleDelete}>
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </>
            )}
          </TooltipProvider>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!mail}>
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">More</span>
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-1 flex-col overflow-auto">
        <div className="flex items-start p-4">
          <div className="flex w-full items-start gap-4 text-sm">
            <Avatar>
              <AvatarImage
                alt={mail.name}
                src={userAvatar?.imageUrl}
                data-ai-hint={userAvatar?.imageHint}
              />
              <AvatarFallback>
                {mail.name
                  .split(' ')
                  .map((chunk) => chunk[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <div className="font-semibold">{mail.name}</div>
              <div className="line-clamp-1 text-xs text-muted-foreground">
                Reply-to: {mail.email}
              </div>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {format(mailDate, "MMM d, yyyy, h:mm a")}
            </div>
          </div>
        </div>
        <div className="p-4 pt-0">
          <h1 className="text-2xl font-bold">{mail.subject}</h1>
          {mail.inReplyTo && (
            <div className="mt-2">
              <Button
                variant="link"
                className="p-0 h-auto text-muted-foreground text-xs"
                onClick={() => onNavigateToMail?.(mail.inReplyTo!)}
              >
                In reply to a message
              </Button>
            </div>
          )}
        </div>

        {mail.hasCryptoTransfer && (
          <div className="mx-4 mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
            {(() => {
              const isDirectTransfer = mail.body.includes('✅ Assets have been transferred directly');
              const claimCodeMatch = mail.body.match(/Your Claim Code: (\d{3} \d{3})|claim code: (\d{6})/i);
              const claimCode = claimCodeMatch ? (claimCodeMatch[1]?.replace(' ', '') || claimCodeMatch[2]) : '';

              if (isDirectTransfer) {
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-primary">Crypto Assets Received</h4>
                      <p className="text-xs text-muted-foreground">
                        Assets have been transferred directly to your wallet. Check your dashboard to view them.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => window.location.href = '/dashboard'}>
                      View Dashboard
                    </Button>
                  </div>
                );
              } else if (claimCode) {
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      <div>
                        <h4 className="font-semibold text-primary">Crypto Assets Attached</h4>
                        <p className="text-xs text-muted-foreground">
                          This email contains crypto assets waiting to be claimed.
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => {
                      window.location.href = `/dashboard/claim?code=${claimCode}`;
                    }}>
                      Claim Assets
                    </Button>
                  </div>
                );
              } else {
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      <div>
                        <h4 className="font-semibold text-primary">Crypto Assets Attached</h4>
                        <p className="text-xs text-muted-foreground">This email contains crypto assets.</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => window.location.href = '/dashboard/claim'}>
                      View Details
                    </Button>
                  </div>
                );
              }
            })()}
          </div>
        )}

        {mail && (
          <div className="flex-1 p-4 pt-0 space-y-6">
            {(() => {
              // Check if the mail body is HTML
              if (isLikelyHtml(mail.body)) {
                const cleanBody = cleanEmailBody(mail.body);
                const sanitizedHtml = DOMPurify.sanitize(cleanBody, {
                  USE_PROFILES: { html: true },
                  ADD_ATTR: ['target', 'style', 'class', 'width', 'height', 'align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan', 'src', 'alt', 'href'],
                  ADD_TAGS: ['style', 'center', 'table', 'tr', 'td', 'tbody', 'thead', 'tfoot', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'hr', 'a', 'img', 'blockquote', 'font', 'u', 'sup', 'sub', 'pre', 'code'],
                  ALLOW_DATA_ATTR: false,
                  FORCE_BODY: true
                });

                return (
                  <div className="rounded-xl border p-4 shadow-sm bg-card text-card-foreground border-slate-200">
                    {/* Header for HTML email same as thread latest message */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {mail.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <div className="text-sm font-semibold text-foreground">
                            {mail.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {`<${mail.email}>`}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(mail.date), "MMM d, yyyy, h:mm a")}
                      </div>
                    </div>

                    <Separator className="my-2 opacity-50" />

                    <div
                      className="email-content text-sm leading-relaxed mt-4"
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                  </div>
                );
              }

              const threadMessages = parseEmailThread(mail);

              const chronologicalMessages = [...threadMessages].reverse();

              return chronologicalMessages.map((msg, index) => {
                const isValidDate = !isNaN(msg.date.getTime());
                const dateDisplay = isValidDate ? format(msg.date, "MMM d, yyyy, h:mm a") : "Unknown Date";

                return (
                  <div key={msg.id} className={cn(
                    "flex flex-col gap-2 rounded-xl border p-4 shadow-sm",
                    msg.isLatest ? "bg-card text-card-foreground border-slate-200" : "bg-muted/30 border-transparent"
                  )}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn(msg.isLatest ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20")}>
                            {msg.senderName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <div className="text-sm font-semibold text-foreground">
                            {msg.senderName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {msg.senderEmail && `<${msg.senderEmail}>`}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {dateDisplay}
                      </div>
                    </div>

                    <Separator className="my-2 opacity-50" />

                    {/* Body */}
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
        <Separator className="mt-auto" />
        <div className="p-4">
          <div className="grid gap-4">
            <Textarea
              className="p-4"
              placeholder={`Reply to ${mail.name}...`}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleReply} disabled={isSendingReply}>
                {isSendingReply ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
              <ComposeDialog initialData={getForwardData()}>
                <Button size="sm" variant="ghost">
                  <Forward className="mr-2 h-4 w-4" />
                  Forward
                </Button>
              </ComposeDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

