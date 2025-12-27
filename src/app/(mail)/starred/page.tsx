import { MailComponent } from '@/components/mail/mail';

export default function StarredPage() {
  return <MailComponent mails={[]} category="all" label="starred" />;
}
