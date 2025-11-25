
import { MailComponent } from '@/components/mail/mail';
import { mails } from '@/lib/data';

export default function UnreadPage() {
  return <MailComponent mails={mails} category="unread" />;
}

