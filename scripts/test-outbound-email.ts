import { config } from 'dotenv';
config();

import { POST } from '../src/app/api/sendgrid/send/route';
import { NextRequest } from 'next/server';

// Mock NextRequest
class MockNextRequest {
    private body: any;

    constructor(body: any) {
        this.body = body;
    }

    async json() {
        return this.body;
    }
}

async function runTest() {
    console.log('Testing SendGrid Outbound Email...');

    // Replace with a valid recipient for actual testing
    const recipient = 'zakkycrypt@gmail.com'; // Placeholder based on username, user can change this
    const sender = 'noreply@dexmail.app'; // Needs to be a verified sender in SendGrid

    const body = {
        to: recipient,
        from: sender,
        subject: 'Test Email from DexMail Platform',
        text: 'This is a test email sent via SendGrid integration.',
        html: '<p>This is a test email sent via <strong>SendGrid</strong> integration.</p>'
    };

    // @ts-ignore
    const req = new MockNextRequest(body) as unknown as NextRequest;

    try {
        const response = await POST(req);
        const data = await response.json();
        console.log('Response:', data);

        if (data.success) {
            console.log(`✅ Email sent successfully to ${recipient}`);
        } else {
            console.error('❌ Failed to send email');
        }
    } catch (error) {
        console.error('Test finished with error:', error);
    }
}

runTest();
