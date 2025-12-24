import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { uploadJSONToIPFS, indexMailOnChain } from './utils';
import { config } from 'dotenv';

config();

const PORT = 587;

const server = new SMTPServer({
    secure: false, // For local testing, we'll use plain TCP or STARTTLS if certificates were available
    authOptional: true, // Allow unauthenticated for now or enforce

    onAuth(auth, session, callback) {
        // Validate user
        // auth.username = email
        // auth.password = signature or password

        // For prototype, we accept any auth
        // In real implementation, verify signature
        if (auth.username) {
            return callback(null, { user: auth.username });
        }
        return callback(new Error('Invalid username'));
    },

    async onData(stream, session, callback) {
        try {
            const parsed = await simpleParser(stream);

            const fromText = parsed.from?.text;
            const toText = Array.isArray(parsed.to)
                ? parsed.to.map(addr => addr.text).join(', ')
                : parsed.to?.text;

            console.log(`Received email from ${fromText} to ${toText}`);

            // 1. Upload to IPFS
            const ipfsResult = await uploadJSONToIPFS({
                from: fromText,
                to: toText,
                subject: parsed.subject,
                text: parsed.text,
                html: parsed.html,
                body: parsed.html || parsed.text, // Prefer HTML for body, but keep fallback
                timestamp: new Date().toISOString(),
                headers: parsed.headers
            });

            console.log('Uploaded to IPFS:', ipfsResult.IpfsHash);

            // 2. Index on Chain
            const recipients = Array.isArray(parsed.to) ? parsed.to : [parsed.to];

            for (const recipient of recipients) {
                if (recipient && recipient.text) {
                    await indexMailOnChain(
                        ipfsResult.IpfsHash,
                        recipient.text,
                        fromText || "",
                        false,
                        false
                    );
                    console.log(`Indexed mail for ${recipient.text}`);
                }
            }

            callback();
        } catch (err) {
            console.error('Error processing email:', err);
            callback(new Error('Error processing email'));
        }
    }
});

server.on('error', err => {
    console.log('SMTP Server Error:', err.message);
});

export function startSMTPServer() {
    server.listen(PORT, () => {
        console.log(`SMTP Server running on port ${PORT}`);
    });
}

// If run directly
if (require.main === module) {
    startSMTPServer();
}
