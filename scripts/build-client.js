const esbuild = require('esbuild');
const path = require('path');

async function build() {
    try {
        await esbuild.build({
            entryPoints: [path.join(__dirname, '../src/lib/fraud/client/fraud-detector.ts')],
            outfile: path.join(__dirname, '../public/fraud-detector.min.js'),
            bundle: true,
            minify: true,
            sourcemap: true,
            target: ['es2015'],
            platform: 'browser',
            format: 'iife', // Immediately Invoked Function Expression for browser
            globalName: 'FraudDetectorLib', // Namespace to avoid collisions
            footer: {
                // Ensure FraudDetector is available globally
                js: 'if (typeof window !== "undefined") { window.FraudDetector = FraudDetectorLib.default; }',
            },
        });
        console.log('✅ Client script bundled successfully: public/fraud-detector.min.js');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
