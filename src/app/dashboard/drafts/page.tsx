
import { MailComponent } from '@/components/mail/mail';
import { mails } from '@/lib/data';

export default function DraftsPage() {
  return <MailComponent mails={mails} category="drafts" />;
}

