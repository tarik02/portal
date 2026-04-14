import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createPuppeteerPortalBackend } from '@tarik02/portal-server';
import { runPortalExampleDev } from '@tarik02/portal-example-common/dev-server';

import { createPuppeteerBrowserRuntime, type PuppeteerBrowserRuntime } from './browser';

const DEFAULT_PORT = 8007;

type DevBackendRuntime = PuppeteerBrowserRuntime;

const main = async () => {
    const indexHtmlPath = fileURLToPath(new URL('../../portal-client-example/index.html', import.meta.url));
    const root = fileURLToPath(new URL('../../portal-client-example/', import.meta.url));
    const shellHtml = await readFile(indexHtmlPath, 'utf8');
    await runPortalExampleDev<DevBackendRuntime>({
        name: 'puppeteer',
        defaultPort: DEFAULT_PORT,
        shellHtml,
        root,
        createBackend: (browserRuntime: DevBackendRuntime) => createPuppeteerPortalBackend(browserRuntime),
        createBrowserRuntime: createPuppeteerBrowserRuntime,
    });
};

try {
    await main();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
