import { expect, test } from '@playwright/test';
import { PORTAL_EXAMPLE_VISUAL_FIXTURE_PATH } from '@tarik02/portal-example-common';

import { expectNonEmptyAttribute, submitAddress, waitForPortalReady } from './test-utils';

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
