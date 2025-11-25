
import { MailComponent } from '@/components/mail/mail';
import { mails } from '@/lib/data';

export default function TrashPage() {
  return <MailComponent mails={mails} category="trash" />;
}

