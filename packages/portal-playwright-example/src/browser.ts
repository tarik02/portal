import { BehaviorSubject } from 'rxjs';
import { chromium, type Page } from 'playwright';

export type PlaywrightBrowserRuntime = {
    readonly page$: BehaviorSubject<Page | null>;
    readonly resolvePage: () => Promise<Page | null>;
    readonly close: () => Promise<void>;
};

export const createPlaywrightBrowserRuntime = async (): Promise<PlaywrightBrowserRuntime> => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        deviceScaleFactor: 1,
        viewport: {
            height: 800,
            width: 1280,
        },
    });
    const page = await context.newPage();
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
            await context.close().catch(() => {});
            await browser.close().catch(() => {});
            page$.complete();
        },
    };
};
