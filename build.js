const fs = require('fs');
const path = require('path');

// Load environment variables from .env file manually
// (No need for dotenv dependency for this simple task)
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.warn('Warning: .env file not found. Using empty environment.');
        return {};
    }
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            env[match[1]] = match[2] ? match[2].trim() : '';
        }
    });
    return env;
}

const env = loadEnv();

function buildManifest() {
    const templatePath = path.join(__dirname, 'manifest.template.json');
    const outputPath = path.join(__dirname, 'manifest.json');

    let content = fs.readFileSync(templatePath, 'utf8');

    // Replace Google Client ID
    const googleId = env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_GOOGLE_ID';
    content = content.replace('{{GOOGLE_CLIENT_ID}}', googleId);

    fs.writeFileSync(outputPath, content);
    console.log(`Generated manifest.json using GOOGLE_CLIENT_ID: ${googleId.substring(0, 5)}...`);
}

function buildConfig() {
    const templatePath = path.join(__dirname, 'config.template.js');
    const outputPath = path.join(__dirname, 'config.js');

    let content = fs.readFileSync(templatePath, 'utf8');

    // Replace Microsoft Client ID
    const msId = env.MS_CLIENT_ID || 'PLACEHOLDER_MS_ID';
    content = content.replace('{{MS_CLIENT_ID}}', msId);

    fs.writeFileSync(outputPath, content);
    console.log(`Generated config.js using MS_CLIENT_ID: ${msId.substring(0, 5)}...`);
}

try {
    buildManifest();
    buildConfig();
    console.log('Build completed successfully.');
} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}
