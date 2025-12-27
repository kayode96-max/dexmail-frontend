import { MailComponent } from '@/components/mail/mail';

export default function SentPage() {
  return <MailComponent mails={[]} category="sent" />;
}
