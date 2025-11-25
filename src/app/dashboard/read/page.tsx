
import { MailComponent } from '@/components/mail/mail';
import { mails } from '@/lib/data';

export default function ReadPage() {
  return <MailComponent mails={mails} category="read" />;
}

