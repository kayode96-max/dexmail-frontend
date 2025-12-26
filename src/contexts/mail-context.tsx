import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mailService, EmailStatus, DraftEmail } from '@/lib/mail-service';
import { Mail } from '@/lib/data';
import { useAccount } from 'wagmi';
import { useAuth } from './auth-context';

interface MailContextType {
    mails: Mail[];
    setMails: (mails: Mail[]) => void;
    refreshMails: () => Promise<void>;
    getEmailStatus: (messageId: string) => EmailStatus;
    updateEmailStatus: (messageId: string, status: Partial<EmailStatus>) => void;
    markAsRead: (messageId: string) => void;
    markAsUnread: (messageId: string) => void;
    moveToSpam: (messageId: string) => void;
    moveToArchive: (messageId: string) => void;
    removeFromArchive: (messageId: string) => void;
    moveToTrash: (messageId: string) => void;
    restoreFromTrash: (messageId: string) => void;
    addLabel: (messageId: string, label: string) => void;
    removeLabel: (messageId: string, label: string) => void;
    deleteMails: (messageIds: string[]) => void;
    archiveMails: (messageIds: string[]) => void;
    spamMails: (messageIds: string[]) => void;
    addLabelToMails: (messageIds: string[], label: string) => void;
    removeLabelFromMails: (messageIds: string[], label: string) => void;
    saveDraft: (draft: DraftEmail) => void;
    deleteDraft: (id: string) => void;
    isLoading: boolean;
}

const MailContext = createContext<MailContextType | undefined>(undefined);

export function MailProvider({ children }: { children: ReactNode }) {
    const [mails, setMails] = useState<Mail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusVersion, setStatusVersion] = useState(0);
    const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
    const { user } = useAuth();

    // Prioritize user.walletAddress for embedded wallets
    const address = user?.walletAddress || wagmiAddress;
    const isConnected = !!address;

    const refreshMails = async (silent = false) => {
        if (!isConnected || !address || !user?.email) {
            setMails([]);
            return;
        }

        if (!silent) setIsLoading(true);
        try {
            // Initialize status cache
            await mailService.initializeStatusCache(user.email);

            // Fetch both inbox and sent emails in parallel
            const [fetchedInbox, fetchedSent, fetchedDrafts] = await Promise.all([
                mailService.getInbox(user.email),
                mailService.getSent(user.email, address),
                mailService.getDrafts(user.email)
            ]);

            const cleanBody = (text: string | undefined | null) => (text || '').replace(/\s*\(?Sent via DexMail - The Decentralized Email Protocol\)?\s*/g, '').trim();

            // Strip HTML tags and get plain text for preview
            const getPreviewText = (html: string): string => {
                // Remove DOCTYPE, html, head, style, and script tags with their content
                let text = html
                    .replace(/<!DOCTYPE[^>]*>/gi, '')
                    .replace(/<head[\s\S]*?<\/head>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                    // Replace common block elements with space/newline
                    .replace(/<br\s*\/?>/gi, ' ')
                    .replace(/<\/?(p|div|tr|li|h[1-6])[^>]*>/gi, ' ')
                    // Remove all remaining HTML tags
                    .replace(/<[^>]+>/g, '')
                    // Decode common HTML entities
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/&amp;/gi, '&')
                    .replace(/&lt;/gi, '<')
                    .replace(/&gt;/gi, '>')
                    .replace(/&quot;/gi, '"')
                    .replace(/&#39;/gi, "'")
                    // Normalize whitespace
                    .replace(/\s+/g, ' ')
                    .trim();
                return text.substring(0, 100) + (text.length > 100 ? '...' : '');
            };

            // Map inbox emails
            const inboxMails: Mail[] = fetchedInbox.map(m => {
                const timestamp = parseInt(m.timestamp, 10) * 1000;
                const dateStr = new Date(timestamp).toISOString();
                const status = mailService.getEmailStatus(m.messageId);
                const cleanedBody = cleanBody(m.body);

                // For inbox: 'from' is the sender, 'to' is the recipient (current user)
                return {
                    id: m.messageId,
                    name: m.from, // Display sender's email in the list
                    email: m.from, // Sender's email for reply-to
                    subject: m.subject,
                    text: getPreviewText(cleanedBody),
                    date: dateStr,
                    read: status.read,

                    labels: status.labels || [],
                    status: status.deleted ? 'trash' :
                        status.archived ? 'archive' :
                            status.spam ? 'spam' :
                                status.draft ? 'draft' : 'inbox',
                    body: cleanedBody,
                    hasCryptoTransfer: m.hasCryptoTransfer,
                    attachments: m.attachments
                };
            });

            // Map sent emails
            const sentMails: Mail[] = fetchedSent.map(m => {
                const timestamp = parseInt(m.timestamp, 10) * 1000;
                const dateStr = new Date(timestamp).toISOString();
                const cleanedBody = cleanBody(m.body);
                const status = mailService.getEmailStatus(m.messageId);

                // Check if self-sent (recipient matches user email)
                // If so, we append a suffix to the ID so it doesn't get deduplicated out by the inbox version
                const isSelfSent = m.to.some(recipient => recipient.toLowerCase() === user.email.toLowerCase());
                const displayId = isSelfSent ? `${m.messageId}_sent_copy` : m.messageId;

                // For sent: 'from' is the sender (current user), 'to' is the recipient
                return {
                    id: displayId,
                    name: m.to[0] || 'Unknown', // Display recipient's email in the list
                    email: m.to[0] || '', // Recipient's email
                    subject: m.subject,
                    text: getPreviewText(cleanedBody),
                    date: dateStr,
                    read: true, // Sent emails are always "read"
                    labels: status.labels || [],
                    status: status.deleted ? 'trash' :
                        status.archived ? 'archive' :
                            status.spam ? 'spam' : 'sent',
                    body: cleanedBody,
                    hasCryptoTransfer: m.hasCryptoTransfer,
                    attachments: m.attachments
                };
            });

            // Combine inbox and sent emails
            let allMails = [...inboxMails, ...sentMails];

            // Fetch drafts
            const draftMails: Mail[] = fetchedDrafts.map(d => {
                const cleanedBody = cleanBody(d.body);
                return {
                    id: d.id,
                    name: '(Draft)',
                    email: d.to,
                    subject: d.subject || '(No Subject)',
                    text: getPreviewText(cleanedBody),
                    date: new Date(d.timestamp).toISOString(),
                    read: true,
                    labels: [],
                    status: 'draft',
                    body: cleanedBody,
                    hasCryptoTransfer: false // Drafts don't have crypto attached yet
                };
            });

            // Combine all emails and deduplicate by ID (keep first occurrence)
            // Note: Since self-sent emails in 'sentMails' now have a different ID, they won't conflict with 'inboxMails'
            const combinedMails = [...allMails, ...draftMails];
            const uniqueMails = combinedMails.filter((mail, index, self) =>
                index === self.findIndex(m => m.id === mail.id)
            );

            setMails(uniqueMails);
        } catch (error) {
            console.error('[MailContext] Failed to fetch mails:', error);
            if (!silent) setMails([]);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    // Effect for account/user changes and polling
    useEffect(() => {
        if (user?.email) {
            mailService.cleanupTrash(user.email); // Auto-delete old trash
        }
        refreshMails(false); // Initial load with spinner

        // Poll for new emails every 10 seconds
        const intervalId = setInterval(() => {
            refreshMails(true); // Silent refresh
        }, 10000);

        return () => clearInterval(intervalId);
    }, [isConnected, address, user?.email]);

    // Effect for status changes (silent refresh)
    useEffect(() => {
        if (statusVersion > 0 && user?.email) {
            // Force reload cache to get latest status from server
            mailService.initializeStatusCache(user.email, true).then(() => {
                refreshMails(true);
            });
        }
    }, [statusVersion]);

    const getEmailStatus = (messageId: string): EmailStatus => {
        const realId = messageId.replace('_sent_copy', '');
        return mailService.getEmailStatus(realId);
    };

    const updateEmailStatus = (messageId: string, status: Partial<EmailStatus>) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.updateEmailStatus(realId, status, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const markAsRead = (messageId: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.markAsRead(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const markAsUnread = (messageId: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.markAsUnread(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const moveToSpam = (messageId: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.moveToSpam(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const moveToArchive = (messageId: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.moveToArchive(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const removeFromArchive = (messageId: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.removeFromArchive(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const moveToTrash = (messageId: string) => {
        if (!user?.email) return;

        const realId = messageId.replace('_sent_copy', '');
        const mail = mails.find(m => m.id === messageId); // Use original ID from state to check status

        if (mail?.status === 'draft') {
            mailService.deleteDraft(realId, user.email);
        } else {
            mailService.moveToTrash(realId, user.email);
        }
        setStatusVersion(v => v + 1);
    };

    const restoreFromTrash = (messageId: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.restoreFromTrash(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const addLabel = (messageId: string, label: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.addLabel(realId, label, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const removeLabel = (messageId: string, label: string) => {
        if (user?.email) {
            const realId = messageId.replace('_sent_copy', '');
            mailService.removeLabel(realId, label, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const deleteMails = (messageIds: string[]) => {
        if (!user?.email) return;

        messageIds.forEach(id => {
            const realId = id.replace('_sent_copy', '');
            const mail = mails.find(m => m.id === id); // Check state using passed ID
            if (mail?.status === 'draft') {
                mailService.deleteDraft(realId, user.email);
            } else {
                mailService.moveToTrash(realId, user.email);
            }
        });
        setStatusVersion(v => v + 1);
    };

    const archiveMails = (messageIds: string[]) => {
        if (user?.email) {
            messageIds.forEach(id => {
                const realId = id.replace('_sent_copy', '');
                mailService.moveToArchive(realId, user.email)
            });
            setStatusVersion(v => v + 1);
        }
    };

    const spamMails = (messageIds: string[]) => {
        if (user?.email) {
            messageIds.forEach(id => {
                const realId = id.replace('_sent_copy', '');
                mailService.moveToSpam(realId, user.email)
            });
            setStatusVersion(v => v + 1);
        }
    };

    const addLabelToMails = (messageIds: string[], label: string) => {
        if (user?.email) {
            messageIds.forEach(id => {
                const realId = id.replace('_sent_copy', '');
                mailService.addLabel(realId, label, user.email)
            });
            setStatusVersion(v => v + 1);
        }
    };

    const removeLabelFromMails = (messageIds: string[], label: string) => {
        if (user?.email) {
            messageIds.forEach(id => {
                const realId = id.replace('_sent_copy', '');
                mailService.removeLabel(realId, label, user.email)
            });
            setStatusVersion(v => v + 1);
        }
    };

    const saveDraft = (draft: DraftEmail) => {
        if (user?.email) {
            // Drafts don't use 'sent' copy so no need to replace
            mailService.saveDraft(draft, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    const deleteDraft = (id: string) => {
        if (user?.email) {
            const realId = id.replace('_sent_copy', '');
            mailService.deleteDraft(realId, user.email);
            setStatusVersion(v => v + 1);
        }
    };

    return (
        <MailContext.Provider
            value={{
                mails,
                setMails,
                refreshMails,
                getEmailStatus,
                updateEmailStatus,
                markAsRead,
                markAsUnread,
                moveToSpam,
                moveToArchive,
                removeFromArchive,
                moveToTrash,
                restoreFromTrash,
                addLabel,
                removeLabel,
                deleteMails,
                archiveMails,
                spamMails,
                addLabelToMails,
                removeLabelFromMails,
                saveDraft,
                deleteDraft,
                isLoading
            }}
        >
            {children}
        </MailContext.Provider>
    );
}

export function useMail() {
    const context = useContext(MailContext);
    if (context === undefined) {
        throw new Error('useMail must be used within a MailProvider');
    }
    return context;
}
