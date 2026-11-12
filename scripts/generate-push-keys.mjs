// Run once locally. Store the private key only in Cloudflare Secrets, never in VITE_* settings or Git.
import { webcrypto } from 'node:crypto';
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=await webcrypto.subtle.exportKey('raw',keys.publicKey),priv=await webcrypto.subtle.exportKey('jwk',keys.privateKey);
console.log('PUSH_VAPID_PUBLIC_KEY='+Buffer.from(pub).toString('base64url'));
console.log('PUSH_VAPID_PRIVATE_KEY='+priv.d);
console.log('PUSH_VAPID_SUBJECT=https://courtvisiongame.com');
