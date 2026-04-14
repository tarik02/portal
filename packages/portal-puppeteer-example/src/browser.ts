import { BehaviorSubject } from 'rxjs';
import { launch, type Page } from 'puppeteer';

export type PuppeteerBrowserRuntime = {
    readonly page$: BehaviorSubject<Page | null>;
    readonly resolvePage: () => Promise<Page | null>;
    readonly close: () => Promise<void>;
};

export const createPuppeteerBrowserRuntime = async (): Promise<PuppeteerBrowserRuntime> => {
    const browser = await launch({
        defaultViewport: {
            deviceScaleFactor: 1,
            height: 800,
            width: 1280,
        },
        headless: 'shell',
    });
    const page = await browser.newPage();
    const page$ = new BehaviorSubject<Page | null>(page);

    const markPageClosed = () => {
        page$.next(null);
    };

    page.on('close', markPageClosed);
    browser.on('disconnected', markPageClosed);

    await page.goto('about:blank');

    return {
        page$,
        resolvePage: () => Promise.resolve(page$.value),
        close: async () => {
            page$.next(null);
            page.off('close', markPageClosed);
            browser.off('disconnected', markPageClosed);

            await page.close().catch(() => {});
            await browser.close().catch(() => {});
            page$.complete();
        },
    };
};
