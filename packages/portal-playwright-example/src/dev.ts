import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createPlaywrightPortalBackend } from '@tarik02/portal-server';
import { runPortalExampleDev } from '@tarik02/portal-example-common/dev-server';

import { createPlaywrightBrowserRuntime, type PlaywrightBrowserRuntime } from './browser';

const DEFAULT_PORT = 8006;

type DevBackendRuntime = PlaywrightBrowserRuntime;

const main = async () => {
    const indexHtmlPath = fileURLToPath(new URL('../../portal-client-example/index.html', import.meta.url));
    const root = fileURLToPath(new URL('../../portal-client-example/', import.meta.url));
    const shellHtml = await readFile(indexHtmlPath, 'utf8');
    await runPortalExampleDev<DevBackendRuntime>({
        name: 'playwright',
        defaultPort: DEFAULT_PORT,
        shellHtml,
        root,
        createBackend: (browserRuntime: DevBackendRuntime) => createPlaywrightPortalBackend(browserRuntime),
        createBrowserRuntime: createPlaywrightBrowserRuntime,
    });
};

try {
    await main();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
