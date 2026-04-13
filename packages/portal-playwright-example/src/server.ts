import { fileURLToPath } from 'node:url';

import { createPlaywrightPortalBackend } from '@tarik02/portal-server';
import { createPortalExampleServer } from '@tarik02/portal-example-common/server';

import { createPlaywrightBrowserRuntime, type PlaywrightBrowserRuntime } from './browser';

export const DEFAULT_PORT = 8006;

type PlaywrightExampleServer = {
    readonly port: number;
    readonly url: string;
    close: () => Promise<void>;
};

type PlaywrightExampleServerOptions = {
    readonly host?: string;
    readonly port?: number;
    readonly createBrowserRuntime?: () => Promise<PlaywrightBrowserRuntime>;
};

const INDEX_HTML_PATH = fileURLToPath(new URL('../../portal-client-example/dist/index.html', import.meta.url));
const ASSETS_DIR = fileURLToPath(new URL('../../portal-client-example/dist/assets/', import.meta.url));

export const createPlaywrightExampleServer = async ({
    host = '127.0.0.1',
    port = DEFAULT_PORT,
    createBrowserRuntime = createPlaywrightBrowserRuntime,
}: PlaywrightExampleServerOptions = {}): Promise<PlaywrightExampleServer> =>
    await createPortalExampleServer({
        assetsDir: ASSETS_DIR,
        createBackend: (browserRuntime) => createPlaywrightPortalBackend(browserRuntime),
        createBrowserRuntime,
        embeddedConfig: {
            hidePortalInput: true,
            portalUrl: '/portal',
        },
        host,
        indexHtmlPath: INDEX_HTML_PATH,
        port,
        portalPath: '/portal',
    });
