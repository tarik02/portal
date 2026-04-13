import { fileURLToPath } from 'node:url';

import { createPuppeteerPortalBackend } from '@tarik02/portal-server';
import { createPortalExampleServer } from '@tarik02/portal-example-common/server';

import { createPuppeteerBrowserRuntime, type PuppeteerBrowserRuntime } from './browser';

export const DEFAULT_PORT = 8007;

type PuppeteerExampleServer = {
    readonly port: number;
    readonly url: string;
    close: () => Promise<void>;
};

type PuppeteerExampleServerOptions = {
    readonly host?: string;
    readonly port?: number;
    readonly createBrowserRuntime?: () => Promise<PuppeteerBrowserRuntime>;
};

const INDEX_HTML_PATH = fileURLToPath(new URL('../../portal-client-example/dist/index.html', import.meta.url));
const ASSETS_DIR = fileURLToPath(new URL('../../portal-client-example/dist/assets/', import.meta.url));

export const createPuppeteerExampleServer = async ({
    host = '127.0.0.1',
    port = DEFAULT_PORT,
    createBrowserRuntime = createPuppeteerBrowserRuntime,
}: PuppeteerExampleServerOptions = {}): Promise<PuppeteerExampleServer> =>
    await createPortalExampleServer({
        assetsDir: ASSETS_DIR,
        createBackend: (browserRuntime) => createPuppeteerPortalBackend(browserRuntime),
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
