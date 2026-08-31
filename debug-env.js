// Debug script to check environment variables
console.log('=== ENVIRONMENT VARIABLE DEBUG ===');

console.log('GOOGLE_SERVICE_ACCOUNT_KEY exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
console.log('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64);

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('GOOGLE_SERVICE_ACCOUNT_KEY length:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length);
    console.log('First 50 chars:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY.substring(0, 50));
    console.log('Last 50 chars:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY.substring(process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length - 50));
}

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    console.log('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 length:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.length);
    console.log('First 50 chars:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.substring(0, 50));
}

console.log('All Google-related env vars:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));

// Test JSON parsing
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
        const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        console.log('JSON parsing successful, type:', parsed.type);
    } catch (error) {
        console.log('JSON parsing failed:', error.message);
    }
}

// Test base64 decoding
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    try {
        const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        console.log('Base64 decoding and JSON parsing successful, type:', parsed.type);
    } catch (error) {
        console.log('Base64 decoding failed:', error.message);
    }
}
