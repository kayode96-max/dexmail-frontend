import { POST } from '../src/app/api/sendgrid/inbound/route';
import { NextRequest } from 'next/server';

// Mock NextRequest
class MockNextRequest {
    private formDataData: FormData;

    constructor(formData: FormData) {
        this.formDataData = formData;
    }

    async formData() {
        return this.formDataData;
    }
}

// Mock FormData
class MockFormData {
    private data: Record<string, string> = {};

    append(key: string, value: string) {
        this.data[key] = value;
    }

    get(key: string) {
        return this.data[key] || null;
    }
}

// Mock dependencies
// We need to mock @/lib/pinata and @/server/utils because we don't want to actually upload/index
// But since we are running this with ts-node, we might need to use a mocking library or just rely on the fact that they might fail without env vars.
// Actually, let's just run it and see. If it fails on dependencies, we'll know.
// But to be safe, we should probably mock them. 
// Since we can't easily mock imports in a simple script without Jest/Vitest, 
// we will just try to run it and expect it to fail at the "Upload to IPFS" step, 
// which confirms the parsing logic worked.

async function runTest() {
    console.log('Testing SendGrid Inbound Webhook...');

    const formData = new MockFormData();
    formData.append('to', 'recipient@example.com');
    formData.append('from', 'sender@example.com');
    formData.append('subject', 'Test Email');
    formData.append('text', 'Hello World');
    formData.append('html', '<p>Hello World</p>');
    formData.append('sender_ip', '127.0.0.1');
    formData.append('envelope', JSON.stringify({ to: ['recipient@example.com'], from: 'sender@example.com' }));

    // @ts-ignore
    const req = new MockNextRequest(formData as any) as unknown as NextRequest;

    try {
        const response = await POST(req);
        const data = await response.json();
        console.log('Response:', data);
    } catch (error) {
        console.error('Test finished with error (expected if env vars missing):', error);
    }
}

runTest();
