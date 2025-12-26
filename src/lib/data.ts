
export type Mail = {
  id: string;
  name: string;
  email: string;
  subject: string;
  text: string;
  date: string;
  read: boolean;
  labels: string[];
  body: string;
  status: 'inbox' | 'sent' | 'draft' | 'spam' | 'archive' | 'trash';
  hasCryptoTransfer?: boolean;
  assets?: any[]; 
  inReplyTo?: string;
};
