import { MailComponent } from '@/components/mail/mail';

export default async function LabelPage({ params }: { params: Promise<{ label: string }> }) {
    const { label } = await params;
    return <MailComponent mails={[]} label={label} />;
}
