import { access } from 'node:fs/promises';
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

const SOURCE_INDEX_HTML_PATH = fileURLToPath(new URL('../../portal-client-example/index.html', import.meta.url));
const SOURCE_ASSETS_DIR = fileURLToPath(new URL('../../portal-client-example/', import.meta.url));
const DIST_INDEX_HTML_PATH = fileURLToPath(new URL('../../portal-client-example/dist/index.html', import.meta.url));
const DIST_ASSETS_DIR = fileURLToPath(new URL('../../portal-client-example/dist/assets/', import.meta.url));

const resolvePortalClientPaths = async () => {
    try {
        await access(DIST_INDEX_HTML_PATH);
        return { indexHtmlPath: DIST_INDEX_HTML_PATH, assetsDir: DIST_ASSETS_DIR };
    } catch {
        return { indexHtmlPath: SOURCE_INDEX_HTML_PATH, assetsDir: SOURCE_ASSETS_DIR };
    }
};

export const createPuppeteerExampleServer = async ({
    host = '127.0.0.1',
    port = DEFAULT_PORT,
    createBrowserRuntime = createPuppeteerBrowserRuntime,
}: PuppeteerExampleServerOptions = {}): Promise<PuppeteerExampleServer> => {
    const { assetsDir, indexHtmlPath } = await resolvePortalClientPaths();

    return await createPortalExampleServer({
        assetsDir,
        createBackend: (browserRuntime) => createPuppeteerPortalBackend(browserRuntime),
        createBrowserRuntime,
        embeddedConfig: {
            hidePortalInput: true,
            portalUrl: '/portal',
        },
        host,
        indexHtmlPath,
        port,
        portalPath: '/portal',
    });
};
