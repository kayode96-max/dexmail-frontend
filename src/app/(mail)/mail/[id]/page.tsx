'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMail } from '@/contexts/mail-context';
import { MailDisplay } from '@/components/mail/mail-display';
import { useAuth } from '@/contexts/auth-context';
import { mailService } from '@/lib/mail-service';
import { Mail } from '@/lib/data';
import { Loader2 } from 'lucide-react';

export default function EmailPage() {
  const params = useParams();
  const router = useRouter();
  const { mails } = useMail();
  const { user } = useAuth();
  const emailId = params.id as string;

  // Check if email exists in context immediately - this is synchronous and fast
  const mailFromContext = useMemo(() => 
    mails.find((m) => m.id === emailId), 
    [mails, emailId]
  );

  const [mail, setMail] = useState<Mail | null>(mailFromContext || null);
  const [isLoading, setIsLoading] = useState(!mailFromContext);

  useEffect(() => {
    const loadEmail = async () => {
      if (!emailId) return;

      // If email exists in context, use it immediately (no loading)
      if (mailFromContext) {
        setMail(mailFromContext);
        setIsLoading(false);
        return;
      }

      // If not in context, fetch it
      if (!user?.email) {
        router.push('/mail');
        return;
      }

      setIsLoading(true);
      try {
        const realId = emailId.replace('_sent_copy', '');
        const message = await mailService.getMessage(realId, user.email);

        if (message) {
          const cleanBody = (text: string | null | undefined) =>
            (text || '').replace(/\s*\(?Sent via DexMail - The Decentralized Email Protocol\)?\s*/g, '').trim();
          const cleanedBody = cleanBody(message.body);

          const fetchedMail: Mail = {
            id: message.messageId,
            name: message.from.split('@')[0] || 'Unknown',
            email: message.from,
            subject: message.subject,
            text: cleanedBody.slice(0, 100) || '',
            date: new Date(Number(message.timestamp) * 1000).toISOString(),
            read: true,
            labels: [],
            status: 'inbox',
            body: cleanedBody,
            hasCryptoTransfer: message.hasCryptoTransfer,
            inReplyTo: message.inReplyTo,
            attachments: message.attachments,
          };

          setMail(fetchedMail);
        } else {
          router.push('/mail');
        }
      } catch (error) {
        console.error('Error loading email:', error);
        router.push('/mail');
      } finally {
        setIsLoading(false);
      }
    };

    loadEmail();
  }, [emailId, mailFromContext, user, router]);

  const handleBack = () => {
    router.back();
  };

  const handleNavigateToMail = (mailId: string) => {
    router.push(`/mail/${mailId}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!mail) {
    return null;
  }

  return <MailDisplay mail={mail} onBack={handleBack} onNavigateToMail={handleNavigateToMail} />;
}
