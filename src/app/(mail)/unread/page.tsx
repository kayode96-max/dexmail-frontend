import { MailComponent } from '@/components/mail/mail';

export default function UnreadPage() {
  return <MailComponent mails={[]} category="unread" />;
}
