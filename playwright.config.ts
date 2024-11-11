import { resolve, join } from 'path';
import { PlaywrightTestConfig } from '@playwright/test';
const port = parseInt(process.env.E2E_PORT, 10) || 38271;
const cwd = resolve(join(__dirname, 'dist'));
const command = `npx http-server -p ${port} -c-1 --cors`;

const config: PlaywrightTestConfig = {
    use: {
        browserName: 'chromium',
        acceptDownloads: true,
    },
    timeout: 60 * 1000,
    webServer: {
        command,
        port,
        timeout: 120 * 1000,
        reuseExistingServer: false,
        cwd,
    },
};
export default config;
