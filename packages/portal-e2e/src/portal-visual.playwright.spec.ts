import { expect, test } from '@playwright/test';
import { PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH } from '@tarik02/portal-example-common';

import {
    expectNonEmptyAttribute,
    submitAddress,
    waitForMatchingBrowserViewImage,
    waitForPortalConnectionOpen,
    waitForPortalReady,
} from './test-utils';

test('playwright backend renders expected visual @playwright', async ({ page }) => {
    await page.goto('/');
    await waitForPortalReady(page);

    const browserViewImage = page.getByTestId('browser-view-image');

    await submitAddress(page, PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH);

    const location = page.getByTestId('portal-location');
    const browserViewShell = page.getByTestId('browser-view-shell');

    await expect(location).toHaveAttribute('data-location', new RegExp(`${PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH}$`));
    await expect(browserViewImage).toBeVisible();
    await expectNonEmptyAttribute(browserViewImage, 'src');
    await page.waitForTimeout(250);
    await expect(browserViewShell).toHaveScreenshot('portal-view-playwright.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    });
});

test('playwright backend shares one portal connection across two clients @playwright', async ({ context, page }) => {
    const secondPage = await context.newPage();

    try {
        await page.goto('/');
        await secondPage.goto('/');
        await waitForPortalConnectionOpen(page);
        await waitForPortalConnectionOpen(secondPage);

        await submitAddress(page, PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH);

        await expect(page.getByTestId('portal-location')).toHaveAttribute(
            'data-location',
            new RegExp(`${PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH}$`),
        );
        await expect(secondPage.getByTestId('portal-location')).toHaveAttribute(
            'data-location',
            new RegExp(`${PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH}$`),
        );
        await expect(page.getByTestId('browser-view-image')).toBeVisible();
        await expect(secondPage.getByTestId('browser-view-image')).toBeVisible();
        await waitForMatchingBrowserViewImage([page, secondPage]);
    } finally {
        await secondPage.close();
    }
});
