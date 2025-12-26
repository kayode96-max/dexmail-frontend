import { NextRequest, NextResponse } from 'next/server';
import { uploadJSONToIPFS, uploadFileToIPFS } from '@/lib/pinata';
import { indexMailOnChain } from '@/server/utils';
import { simpleParser } from 'mailparser';

interface EmailAttachment {
    name: string;
    size: number;
    type: string;
    cid?: string;   // IPFS CID (for uploaded attachments)
    url?: string;   // Direct URL fallback (for failed uploads)
    content?: string; // Base64 content fallback
}

// SendGrid Inbound Parse Webhook handler
export async function POST(req: NextRequest) {
    // Vercel logs are captured from console.log
    const log = (msg: string) => console.log(`[Inbound Webhook] ${msg}`);

    try {
        log('Inbound webhook triggered');
        // Parse multipart/form-data
        const formData = await req.formData();
        log('FormData received');
        const keys = Array.from(formData.keys());
        log(`FormData keys: ${keys.join(', ')}`);

        // Extract fields
        const to = formData.get('to') as string;
        const from = formData.get('from') as string;
        const subject = formData.get('subject') as string;
        let text = formData.get('text') as string;
        let html = formData.get('html') as string;
        const headers = formData.get('headers') as string; // Capture headers
        const rawEmail = formData.get('email') as string; // Raw email content

        log(`Raw From: ${from}`);
        log(`Raw To: ${to}`);
        log(`Raw Subject: ${subject}`);
        log(`Raw Headers: ${headers ? headers.substring(0, 100) : 'null'}...`);
        log(`Raw Email length: ${rawEmail ? rawEmail.length : 'null'}`);
        const senderIp = formData.get('sender_ip') as string;
        const dkims = formData.get('dkim') as string;
        const spf = formData.get('SPF') as string;
        const envelope = formData.get('envelope') as string;
        const charsets = formData.get('charsets') as string;

        // Handle attachments from SendGrid
        const attachments: EmailAttachment[] = [];
        const attachmentInfo = formData.get('attachment-info') as string;
        
        if (attachmentInfo) {
            try {
                const attachmentMeta = JSON.parse(attachmentInfo);
                log(`Found ${Object.keys(attachmentMeta).length} attachment(s)`);
                
                for (const [key, meta] of Object.entries(attachmentMeta) as [string, any][]) {
                    const file = formData.get(key) as File;
                    if (file) {
                        log(`Processing attachment: ${meta.filename} (${meta.type}, ${file.size} bytes)`);
                        try {
                            // Upload attachment to IPFS
                            const attachmentResult = await uploadFileToIPFS(file);
                            attachments.push({
                                name: meta.filename || file.name,
                                size: file.size,
                                type: meta.type || file.type,
                                cid: attachmentResult.IpfsHash
                            });
                            log(`Uploaded attachment to IPFS: ${attachmentResult.IpfsHash}`);
                        } catch (attachErr) {
                            console.error(`[SendGrid Inbound] Failed to upload attachment ${meta.filename}:`, attachErr);
                            // Fallback: Store as base64 data URL if IPFS upload fails
                            try {
                                const arrayBuffer = await file.arrayBuffer();
                                const base64 = Buffer.from(arrayBuffer).toString('base64');
                                const dataUrl = `data:${meta.type || file.type};base64,${base64}`;
                                attachments.push({
                                    name: meta.filename || file.name,
                                    size: file.size,
                                    type: meta.type || file.type,
                                    url: dataUrl
                                });
                                log(`Stored attachment as data URL fallback: ${meta.filename}`);
                            } catch (fallbackErr) {
                                console.error(`[SendGrid Inbound] Failed to create fallback for ${meta.filename}:`, fallbackErr);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[SendGrid Inbound] Failed to parse attachment-info:', e);
            }
        }

        // Also check for attachments in parsed raw email
        let parsedAttachments: any[] = [];

        // Fallback: Parse raw email if text/html are missing
        if (!text && !html && rawEmail) {
            try {
                log('Parsing raw email content...');
                const parsed = await simpleParser(rawEmail);
                text = parsed.text || '';
                html = (parsed.html as string) || '';
                parsedAttachments = parsed.attachments || [];
                log(`Parsed raw email. Text length: ${text.length}, HTML length: ${html.length}, Attachments: ${parsedAttachments.length}`);
            } catch (parseError) {
                console.error('[SendGrid Inbound] Failed to parse raw email:', parseError);
                log('Failed to parse raw email');
            }
        }

        // Process attachments from parsed email if not already processed
        if (parsedAttachments.length > 0 && attachments.length === 0) {
            for (const att of parsedAttachments) {
                try {
                    log(`Processing parsed attachment: ${att.filename} (${att.contentType}, ${att.size} bytes)`);
                    const blob = new Blob([att.content], { type: att.contentType });
                    const file = new File([blob], att.filename || 'attachment', { type: att.contentType });
                    const attachmentResult = await uploadFileToIPFS(file);
                    attachments.push({
                        name: att.filename || 'attachment',
                        size: att.size,
                        type: att.contentType,
                        cid: attachmentResult.IpfsHash
                    });
                    log(`Uploaded parsed attachment to IPFS: ${attachmentResult.IpfsHash}`);
                } catch (attachErr) {
                    console.error(`[SendGrid Inbound] Failed to upload parsed attachment:`, attachErr);
                    // Fallback: Store as base64 data URL if IPFS upload fails
                    try {
                        const base64 = Buffer.isBuffer(att.content) 
                            ? att.content.toString('base64')
                            : Buffer.from(att.content).toString('base64');
                        const dataUrl = `data:${att.contentType};base64,${base64}`;
                        attachments.push({
                            name: att.filename || 'attachment',
                            size: att.size,
                            type: att.contentType,
                            url: dataUrl
                        });
                        log(`Stored parsed attachment as data URL fallback: ${att.filename}`);
                    } catch (fallbackErr) {
                        console.error(`[SendGrid Inbound] Failed to create fallback for parsed attachment:`, fallbackErr);
                    }
                }
            }
        }

        log(`Received email from: ${from} to: ${to} subject: ${subject}`);
        log(`Final Text length: ${text ? text.length : 'null'}, HTML length: ${html ? html.length : 'null'}`);
        log(`Total attachments: ${attachments.length}`);
        console.log(`[SendGrid Inbound] Received email from ${from} to ${to}`);

        // 1. Upload to IPFS
        // We construct a JSON object similar to what we do in the frontend
        // Prefer HTML for rich email content rendering, fallback to text
        const emailData = {
            from,
            to: [to], // SendGrid sends 'to' as a string, potentially multiple addresses
            subject,
            body: html || text || 'No content', // Prefer HTML for rich content rendering
            // Store both versions for compatibility:
            htmlBody: html,
            textBody: text,
            timestamp: new Date().toISOString(),
            attachments: attachments.length > 0 ? attachments : undefined,
            headers: {
                'sender-ip': senderIp,
                'dkim': dkims,
                'spf': spf
            },
            source: 'sendgrid-inbound'
        };

        const ipfsResult = await uploadJSONToIPFS(emailData);
        console.log('[SendGrid Inbound] Uploaded to IPFS:', ipfsResult.IpfsHash);
        log(`Uploaded to IPFS: ${ipfsResult.IpfsHash}`);

        // 2. Index on Chain
        // We need to parse the 'to' field to handle multiple recipients if necessary
        // SendGrid 'to' field usually looks like "Name <email@domain.com>" or just "email@domain.com"
        // For now, we'll just take the raw string or try to extract the email.
        // A simple regex to extract email might be useful, but for now let's trust the 'envelope' or just use the 'to' string.

        // Parse envelope if available for precise recipient
        let recipient = to;
        if (envelope) {
            try {
                const parsedEnvelope = JSON.parse(envelope);
                if (parsedEnvelope.to && parsedEnvelope.to.length > 0) {
                    recipient = parsedEnvelope.to[0]; // Take the first one for now
                }
            } catch (e) {
                console.warn('[SendGrid Inbound] Failed to parse envelope:', e);
            }
        }

        // Clean up recipient email (remove name if present)
        // e.g. "John Doe <john@example.com>" -> "john@example.com"
        const emailRegex = /<([^>]+)>/;
        const match = recipient.match(emailRegex);
        if (match) {
            recipient = match[1];
        }

        console.log(`[SendGrid Inbound] Indexing for recipient: ${recipient}`);
        log(`Indexing for recipient: ${recipient}`);

        // Call the server-side utility to index on chain
        // Note: indexMailOnChain uses a relayer wallet defined in env vars
        const txHash = await indexMailOnChain(
            ipfsResult.IpfsHash,
            recipient,
            from, // originalSender
            true, // isExternal
            false // hasCrypto
        );

        console.log(`[SendGrid Inbound] Indexed on chain. Tx: ${txHash}`);
        log(`Indexed on chain. Tx: ${txHash}`);

        return NextResponse.json({ success: true, cid: ipfsResult.IpfsHash, txHash });
    } catch (error: any) {
        console.error('[SendGrid Inbound] Error processing email:', error);
        log(`Error: ${error.message}`);
        return NextResponse.json(
            { error: 'Failed to process inbound email', details: error.message },
            { status: 500 }
        );
    }
}
