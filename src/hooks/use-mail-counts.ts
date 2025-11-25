import { useMail } from '@/contexts/mail-context';
import { useMemo } from 'react';

export interface MailCounts {
    all: number;
    unread: number;
    read: number;
    sent: number;
    drafts: number;
    spam: number;
    archive: number;
    trash: number;
    claim: number;
}

export function useMailCounts(): MailCounts {
    const { mails } = useMail();

    return useMemo(() => {
        const counts: MailCounts = {
            all: 0,
            unread: 0,
            read: 0,
            sent: 0,
            drafts: 0,
            spam: 0,
            archive: 0,
            trash: 0,
            claim: 0
        };

        mails.forEach(mail => {
            // Count by status
            if (mail.status === 'sent') {
                counts.sent++;
            } else if (mail.status === 'draft') {
                counts.drafts++;
            } else if (mail.status === 'spam') {
                counts.spam++;
            } else if (mail.status === 'archive') {
                counts.archive++;
            } else if (mail.status === 'trash') {
                counts.trash++;
            } else if (mail.status === 'inbox') {
                counts.all++;

                // Count read/unread within inbox
                if (mail.read) {
                    counts.read++;
                } else {
                    counts.unread++;
                }
            }

            // Count claim emails (unclaimed crypto transfers in inbox)
            if (mail.hasCryptoTransfer && mail.status === 'inbox') {
                counts.claim++;
            }
        });

        return counts;
    }, [mails]);
}
