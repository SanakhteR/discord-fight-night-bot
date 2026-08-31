// Script to create base64 encoded Google service account key
const fs = require('fs');
require('dotenv').config();

const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY not found in .env file');
    process.exit(1);
}

// Create base64 encoded version
const base64Key = Buffer.from(serviceAccountJson).toString('base64');

console.log('=== BASE64 ENCODED GOOGLE SERVICE ACCOUNT KEY ===');
console.log(base64Key);
console.log('\n=== INSTRUCTIONS ===');
console.log('1. Copy the base64 string above');
console.log('2. In Fly.io dashboard, add a new secret:');
console.log('   Name: GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');
console.log('   Value: [paste the base64 string]');
console.log('3. Remove the old GOOGLE_SERVICE_ACCOUNT_KEY secret');
console.log('4. Restart your app');

// Also save to file for reference
fs.writeFileSync('google-service-account-base64.txt', base64Key);
console.log('\nBase64 key also saved to: google-service-account-base64.txt');
