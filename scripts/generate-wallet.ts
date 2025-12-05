import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const key = generatePrivateKey();
const account = privateKeyToAccount(key);

console.log('Generated New Relayer Wallet:');
console.log('Private Key:', key);
console.log('Address:', account.address);
