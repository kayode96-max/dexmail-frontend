const { config } = require('dotenv');
config();

async function testNgrokWebhook() {
    const ngrokUrl = 'https://collinear-bonnie-clarifyingly.ngrok-free.dev/api/sendgrid/inbound';
    console.log(`Testing Inbound Webhook via Ngrok: ${ngrokUrl}`);

    const formData = new FormData();
    formData.append('to', 'olayson@dexmail.app');
    formData.append('from', 'sender@gmail.com');
    formData.append('subject', 'Test Email via Ngrok');
    formData.append('text', 'Hello from Ngrok Test');
    formData.append('html', '<p>Hello from Ngrok Test</p>');
    formData.append('sender_ip', '127.0.0.1');
    formData.append('envelope', JSON.stringify({ to: ['olayson@dexmail.app'], from: 'sender@gmail.com' }));

    try {
        const response = await fetch(ngrokUrl, {
            method: 'POST',
            body: formData
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testNgrokWebhook();
