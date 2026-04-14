import { expect, test } from '@playwright/test';
import { PORTAL_EXAMPLE_INTERACTIVE_FIXTURE_PATH } from '@tarik02/portal-example-common';

import {
    clickBrowserViewAt,
    hoverBrowserViewAt,
    submitAddress,
    waitForBrowserViewFrameChange,
    waitForPortalReady,
} from './test-utils';

const INTERACTIVE_FIXTURE_MOUSE_TARGET = {
    x: 946,
    y: 246,
} as const;

const INTERACTIVE_FIXTURE_KEYBOARD_INPUT = {
    x: 946,
    y: 516,
} as const;

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPortalReady(page);
    await submitAddress(page, PORTAL_EXAMPLE_INTERACTIVE_FIXTURE_PATH);
    await expect(page.getByTestId('portal-location')).toHaveAttribute(
        'data-location',
        new RegExp(`${PORTAL_EXAMPLE_INTERACTIVE_FIXTURE_PATH}$`),
    );
});

test('puppeteer backend forwards mouse input to the remote page @puppeteer', async ({ page }) => {
    const browserViewShell = page.getByTestId('browser-view-shell');

    await waitForBrowserViewFrameChange(page, async () => {
        await hoverBrowserViewAt(page, INTERACTIVE_FIXTURE_MOUSE_TARGET);
    });
    await waitForBrowserViewFrameChange(page, async () => {
        await clickBrowserViewAt(page, INTERACTIVE_FIXTURE_MOUSE_TARGET);
    });

    await expect(browserViewShell).toHaveScreenshot('portal-mouse-puppeteer.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    });
});

test('puppeteer backend forwards keyboard input to the remote page @puppeteer', async ({ page }) => {
    const browserViewShell = page.getByTestId('browser-view-shell');

    await waitForBrowserViewFrameChange(page, async () => {
        await clickBrowserViewAt(page, INTERACTIVE_FIXTURE_KEYBOARD_INPUT);
    });
    await waitForBrowserViewFrameChange(page, async () => {
        await browserViewShell.press('a');
        await browserViewShell.press('b');
    });

    await expect(browserViewShell).toHaveScreenshot('portal-keyboard-puppeteer.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    });
});
