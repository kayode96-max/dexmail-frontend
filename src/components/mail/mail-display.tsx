
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
  Paperclip,
  Download,
  File,
  Image,
  FileText,
  FileArchive,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ChevronDown,
  ChevronUp,
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
import { useEffect, useState, useCallback } from 'react';
import { ComposeDialog } from './compose-dialog';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { mailService } from '@/lib/mail-service';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import { useSendUserOperation, useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';

// Component to render message content with collapsible forwarded headers
function MessageContent({ content }: { content: string }) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Parse content into segments (regular text and forwarded headers)
  const parseContent = (text: string) => {
    const forwardedPattern = /(-{5,}\s*Forwarded message\s*-{5,})\n(From:\s*(.+?))\n(Date:\s*(.+?))\n(Subject:\s*(.+?))\n(To:\s*(.+?))\n/gi;
    const segments: Array<{ type: 'text' | 'forwarded'; content: string; from?: string; date?: string; subject?: string; to?: string }> = [];
    
    let lastIndex = 0;
    let match;
    let forwardedIndex = 0;
    
    while ((match = forwardedPattern.exec(text)) !== null) {
      // Add text before the forwarded header
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      
      // Add the forwarded header as a structured segment
      segments.push({
        type: 'forwarded',
        content: match[0],
        from: match[3],
        date: match[5],
        subject: match[7],
        to: match[9],
      });
      
      lastIndex = match.index + match[0].length;
      forwardedIndex++;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.slice(lastIndex) });
    }
    
    return segments;
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const segments = parseContent(content);
  let forwardedCounter = 0;

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        }
        
        const currentForwardedIndex = forwardedCounter++;
        const isExpanded = expandedSections.has(currentForwardedIndex);
        
        return (
          <div 
            key={index} 
            className="border-l-2 border-muted-foreground/30 pl-3 my-3 py-1"
          >
            <div className="text-muted-foreground font-medium text-xs mb-1">
              ---------- Forwarded message ----------
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">From: </span>
              <span>{segment.from}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Date: </span>
              <span>{segment.date}</span>
            </div>
            {isExpanded && (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">Subject: </span>
                  <span>{segment.subject}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">To: </span>
                  <span>{segment.to}</span>
                </div>
              </>
            )}
            <button
              onClick={() => toggleSection(currentForwardedIndex)}
              className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
            >
              {isExpanded ? (
                <>Show less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Show more details <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          </div>
        );
      })}
    </>
  );
}

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

// Transform forwarded message headers into collapsible HTML structure
function transformForwardedHeaders(content: string): string {
  // Pattern to match forwarded message header block (plain text)
  const forwardedPattern = /(-{5,}\s*Forwarded message\s*-{5,})\n(From:\s*(.+?))\n(Date:\s*(.+?))\n(Subject:\s*(.+?))\n(To:\s*(.+?))\n/gi;
  
  let result = content.replace(forwardedPattern, (match, title, fromLine, fromValue, dateLine, dateValue, subjectLine, subjectValue, toLine, toValue) => {
    return `<div class="forwarded-header">
      <div class="forwarded-title">${title}</div>
      <div class="forwarded-from">${fromLine}</div>
      <div class="forwarded-date">${dateLine}</div>
      <div class="forwarded-details">
        <div>${subjectLine}</div>
        <div>${toLine}</div>
      </div>
      <span class="forwarded-toggle">Show more details ▼</span>
    </div>\n`;
  });

  // Transform Gmail-style forwarded headers (HTML with gmail_attr class)
  // Pattern: <div ... class="gmail_attr">---------- Forwarded message ---------<br>From: ...<br>Date: ...<br>Subject: ...<br>To: ...<br></div>
  const gmailAttrPattern = /(<div[^>]*class="[^"]*gmail_attr[^"]*"[^>]*>)([\s\S]*?---------- Forwarded message ---------[\s\S]*?)(<br\s*\/?>)([\s\S]*?)(<br\s*\/?>)([\s\S]*?)(<br\s*\/?>)([\s\S]*?)(<br\s*\/?>)([\s\S]*?)(<\/div>)/gi;
  
  result = result.replace(gmailAttrPattern, (match, openDiv, forwardedTitle, br1, fromContent, br2, dateContent, br3, subjectContent, br4, toContent, closeDiv) => {
    return `${openDiv}
      <div class="gmail-forwarded-visible">${forwardedTitle.trim()}${br1}${fromContent}${br2}${dateContent}</div>
      <div class="gmail-forwarded-hidden">${br3}${subjectContent}${br4}${toContent}</div>
      <span class="gmail-forwarded-toggle">Show more ▼</span>
    ${closeDiv}`;
  });

  return result;
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

// Helper function to get file icon based on MIME type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return FileArchive;
  return File;
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Get attachment URL - handles both IPFS CID and direct URLs
function getAttachmentUrl(attachment: { cid?: string; url?: string }): string {
  if (attachment.cid) {
    return `https://gateway.pinata.cloud/ipfs/${attachment.cid}`;
  }
  if (attachment.url) {
    return attachment.url;
  }
  return '';
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
  
  // Lightbox state for image attachments
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Coinbase CDP hooks for embedded wallet
  const { sendUserOperation } = useSendUserOperation();
  const { currentUser } = useCurrentUser();
  const { isSignedIn } = useIsSignedIn();

  // Get image attachments for lightbox
  const imageAttachments = mail?.attachments?.filter(a => a.type.startsWith('image/')) || [];

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const nextImage = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % imageAttachments.length);
  }, [imageAttachments.length]);

  const prevImage = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + imageAttachments.length) % imageAttachments.length);
  }, [imageAttachments.length]);

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, nextImage, prevImage]);

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
    <div className="flex h-full max-h-full flex-col overflow-hidden">
      {/* Fixed Header Toolbar */}
      <div className="flex-none flex items-center p-2 md:p-4">
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
                <ComposeDialog initialData={getForwardData()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Forward className="h-4 w-4" />
                        <span className="sr-only">Forward</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Forward</TooltipContent>
                  </Tooltip>
                </ComposeDialog>
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
      <Separator className="flex-none" />
      
      {/* Scrollable Message Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
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
              <div className="grid gap-1 min-w-0 flex-1">
                <div className="font-semibold truncate">{mail.name}</div>
              <div className="line-clamp-1 text-xs text-muted-foreground truncate">
                Reply-to: {mail.email}
              </div>
            </div>
            <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {format(mailDate, "MMM d, yyyy, h:mm a")}
            </div>
          </div>
        </div>
        <div className="p-4 pt-0">
          <h1 className="text-xl md:text-2xl font-bold break-words">{mail.subject}</h1>
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
                // Transform forwarded headers before sanitization
                const transformedBody = transformForwardedHeaders(cleanBody);
                const sanitizedHtml = DOMPurify.sanitize(transformedBody, {
                  USE_PROFILES: { html: true },
                  ADD_ATTR: ['target', 'style', 'class', 'width', 'height', 'align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan', 'src', 'alt', 'href', 'onclick'],
                  ADD_TAGS: ['style', 'center', 'table', 'tr', 'td', 'tbody', 'thead', 'tfoot', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'hr', 'a', 'img', 'blockquote', 'font', 'u', 'sup', 'sub', 'pre', 'code'],
                  ALLOW_DATA_ATTR: false,
                  FORCE_BODY: true
                });

                return (
                  <div className="rounded-xl border p-4 shadow-sm bg-card text-card-foreground border-slate-200">
                    {/* Header for HTML email same as thread latest message */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {mail.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {mail.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {`<${mail.email}>`}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {format(new Date(mail.date), "MMM d, yyyy, h:mm a")}
                      </div>
                    </div>

                    <Separator className="my-2 opacity-50" />

                    <div
                      className="email-content text-sm leading-relaxed mt-4"
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                      onClick={(e) => {
                        // Handle forwarded header toggle click
                        const target = e.target as HTMLElement;
                        
                        // Handle custom forwarded-header class
                        const forwardedHeader = target.closest('.forwarded-header');
                        if (forwardedHeader) {
                          forwardedHeader.classList.toggle('expanded');
                          const toggle = forwardedHeader.querySelector('.forwarded-toggle');
                          if (toggle) {
                            toggle.textContent = forwardedHeader.classList.contains('expanded') 
                              ? 'Show less ▲' 
                              : 'Show more ▼';
                          }
                        }
                        
                        // Handle Gmail-style forwarded header (.gmail_attr)
                        const gmailAttr = target.closest('.gmail_attr');
                        if (gmailAttr) {
                          gmailAttr.classList.toggle('expanded');
                          const toggle = gmailAttr.querySelector('.gmail-forwarded-toggle');
                          if (toggle) {
                            toggle.textContent = gmailAttr.classList.contains('expanded') 
                              ? 'Show less ▲' 
                              : 'Show more ▼';
                          }
                        }
                      }}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className={cn(msg.isLatest ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20")}>
                            {msg.senderName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {msg.senderName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {msg.senderEmail && `<${msg.senderEmail}>`}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {dateDisplay}
                      </div>
                    </div>

                    <Separator className="my-2 opacity-50" />

                    {/* Body */}
                    <div className="text-sm whitespace-pre-wrap leading-relaxed break-words overflow-hidden">
                      <MessageContent content={msg.content} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* File Attachments Section */}
        {mail && mail.attachments && mail.attachments.length > 0 && (
          <div className="px-4 pb-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Attachments ({mail.attachments.length})
                </span>
              </div>

              {/* Attachments list */}
              <div className="grid gap-2">
                {mail.attachments.map((attachment, index) => {
                  const FileIcon = getFileIcon(attachment.type);
                  const downloadUrl = getAttachmentUrl(attachment);
                  const isImage = attachment.type.startsWith('image/');
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      {/* Preview or Icon */}
                      {isImage && downloadUrl ? (
                        <div 
                          className="h-10 w-10 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                          onClick={() => {
                            const imgIndex = imageAttachments.findIndex(a => 
                              (a.cid && a.cid === attachment.cid) || (a.url && a.url === attachment.url)
                            );
                            if (imgIndex !== -1) openLightbox(imgIndex);
                          }}
                        >
                          <img
                            src={downloadUrl}
                            alt={attachment.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <FileIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isImage && downloadUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const imgIndex = imageAttachments.findIndex(a => 
                                (a.cid && a.cid === attachment.cid) || (a.url && a.url === attachment.url)
                              );
                              if (imgIndex !== -1) openLightbox(imgIndex);
                            }}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={attachment.name}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Image Lightbox */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button]:hidden">
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
            {imageAttachments.length > 0 && (
              <div className="relative w-full h-full min-h-[50vh] flex items-center justify-center">
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10 rounded-full bg-black/50"
                  onClick={closeLightbox}
                >
                  <X className="h-6 w-6" />
                </Button>

                {/* Image counter */}
                {imageAttachments.length > 1 && (
                  <div className="absolute top-2 left-2 z-10 text-white text-sm bg-black/50 px-2 py-1 rounded">
                    {lightboxIndex + 1} / {imageAttachments.length}
                  </div>
                )}

                {/* Previous button */}
                {imageAttachments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-12 w-12"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                )}

                {/* Main image */}
                <div className="flex flex-col items-center justify-center p-4 max-h-[90vh]">
                  <img
                    src={imageAttachments[lightboxIndex] ? getAttachmentUrl(imageAttachments[lightboxIndex]) : ''}
                    alt={imageAttachments[lightboxIndex]?.name}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                  <div className="mt-2 text-center">
                    <p className="text-white text-sm">{imageAttachments[lightboxIndex]?.name}</p>
                    <p className="text-white/60 text-xs">
                      {formatFileSize(imageAttachments[lightboxIndex]?.size || 0)}
                    </p>
                  </div>
                </div>

                {/* Next button */}
                {imageAttachments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-12 w-12"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                )}

                {/* Download button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute bottom-4 right-4 z-10 text-white hover:bg-white/20"
                  asChild
                >
                  <a
                    href={imageAttachments[lightboxIndex] ? getAttachmentUrl(imageAttachments[lightboxIndex]) : ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={imageAttachments[lightboxIndex]?.name}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>

                {/* Thumbnail strip for multiple images */}
                {imageAttachments.length > 1 && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-2 bg-black/50 rounded-lg max-w-[80vw] overflow-x-auto">
                    {imageAttachments.map((attachment, index) => (
                      <button
                        key={index}
                        onClick={() => setLightboxIndex(index)}
                        className={cn(
                          "h-12 w-12 rounded overflow-hidden flex-shrink-0 border-2 transition-all",
                          index === lightboxIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        <img
                          src={getAttachmentUrl(attachment)}
                          alt={attachment.name}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Fixed Reply Box */}
      <div className="flex-none border-t bg-background p-3 md:p-4 pb-20 md:pb-4">
        <div className="relative">
          <Textarea
            className="pr-12 min-h-[60px] resize-none"
            placeholder={`Reply to ${mail.name}...`}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={2}
          />
          <Button 
            size="icon" 
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleReply} 
            disabled={isSendingReply}
          >
            {isSendingReply ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

