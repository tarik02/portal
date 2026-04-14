import { expect, type Locator, type Page } from '@playwright/test';

const REMOTE_BROWSER_VIEW_SIZE = {
    height: 800,
    width: 1280,
} as const;

export const waitForPortalReady = async (page: Page) => {
    const connectionStatus = page.getByTestId('portal-connection-status');
    const frameSize = page.getByTestId('portal-frame-size');
    const browserViewImage = page.getByTestId('browser-view-image');

    await expect(connectionStatus).toHaveText('open');
    await expect(frameSize).not.toHaveText(/no frame/i);
    await expect(browserViewImage).toBeVisible();
};

export const submitAddress = async (page: Page, value: string) => {
    const addressInput = page.getByTestId('portal-address-input');

    await addressInput.fill(value);
    await addressInput.press('Enter');
};

export const expectNonEmptyAttribute = async (locator: Locator, name: string) => {
    await expect(locator).toHaveAttribute(name, /.+/);
};

const getBrowserViewPosition = async (page: Page, point: { x: number; y: number }) => {
    const shell = page.getByTestId('browser-view-shell');
    const box = await shell.boundingBox();

    if (!box) {
        throw new Error('browser view shell is not visible');
    }

    return {
        x: (point.x / REMOTE_BROWSER_VIEW_SIZE.width) * box.width,
        y: (point.y / REMOTE_BROWSER_VIEW_SIZE.height) * box.height,
    };
};

export const waitForBrowserViewFrameChange = async (page: Page, action: () => Promise<void> | void) => {
    const browserViewImage = page.getByTestId('browser-view-image');
    const previousSrc = await browserViewImage.getAttribute('src');

    await action();

    await expect
        .poll(async () => await browserViewImage.getAttribute('src'))
        .not.toBe(previousSrc);
};

export const clickBrowserViewAt = async (page: Page, point: { x: number; y: number }) => {
    const shell = page.getByTestId('browser-view-shell');

    await shell.click({
        position: await getBrowserViewPosition(page, point),
    });
};

export const hoverBrowserViewAt = async (page: Page, point: { x: number; y: number }) => {
    const shell = page.getByTestId('browser-view-shell');

    await shell.hover({
        position: await getBrowserViewPosition(page, point),
    });
};
