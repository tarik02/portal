import { createPuppeteerExampleServer, DEFAULT_PORT } from './server';

const readPort = (value: string | undefined) => {
    if (value === undefined || value.trim() === '') {
        return DEFAULT_PORT;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : DEFAULT_PORT;
};

const readHost = (value: string | undefined) => value?.trim() || '127.0.0.1';

const toExampleHttpUrl = (url: string) => url.replace(/^ws:/, 'http:').replace(/\/portal$/, '/');

const main = async () => {
    const server = await createPuppeteerExampleServer({
        host: readHost(process.env.HOST),
        port: readPort(process.env.PORT),
    });

    console.log(`puppeteer example ready: ${toExampleHttpUrl(server.url)}`);

    let closing = false;
    const shutdown = async () => {
        if (closing) {
            return;
        }

        closing = true;
        process.off('SIGINT', onSigint);
        process.off('SIGTERM', onSigterm);
        await server.close();
    };

    const onSigint = () => {
        void shutdown();
    };

    const onSigterm = () => {
        void shutdown();
    };

    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
};

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
