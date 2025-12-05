import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';

config();

const key = process.env.RELAYER_PRIVATE_KEY;

if (!key) {
    console.log('RELAYER_PRIVATE_KEY is not set in .env');
} else {
    try {
        const account = privateKeyToAccount(key as `0x${string}`);
        console.log('Relayer Address:', account.address);
    } catch (e) {
        console.error('Invalid private key format');
    }
}
