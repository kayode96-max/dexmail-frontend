import { MailComponent } from '@/components/mail/mail';

export default function LabelPage({ params }: { params: { labelName: string } }) {
  return <MailComponent mails={[]} category="all" label={params.labelName} />;
}
