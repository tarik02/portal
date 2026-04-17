import { distinctUntilChanged, EMPTY, fromEventPattern, Observable, startWith, switchMap } from 'rxjs';
import type { CDPSession, Page } from 'puppeteer-core';

import {
    normalizePortalBackendError,
    PortalBackendError,
    type PortalBackend,
    type PortalViewFrame,
    type PortalViewSource,
} from './backend';
import type { PortalExecutableCommand } from '@tarik02/portal-core';

type PuppeteerPageResolver = {
    page$: Observable<Page | null>;
    resolvePage: () => Promise<Page | null>;
};

const nextFrameId = () => globalThis.crypto.randomUUID();

const observeLocation = (page$: Observable<Page | null>) =>
    page$.pipe(
        switchMap((page) => {
            if (page === null) {
                return EMPTY;
            }

            return fromEventPattern<void>(
                (handler) => {
                    page.on('framenavigated', handler);
                },
                (handler) => {
                    page.off('framenavigated', handler);
                },
            ).pipe(
                startWith(),
                switchMap(() => [page.url()]),
            );
        }),
        distinctUntilChanged(),
    );

const resolvePageOrFail = async (resolvePage: () => Promise<Page | null>) => {
    const page = await resolvePage();
    if (page === null || page.isClosed()) {
        throw new PortalBackendError('NO_ACTIVE_PAGE', 'No active page is available');
    }

    return page;
};

const executeMouseCommand = async (page: Page, command: Extract<PortalExecutableCommand, { type: 'input.mouse' }>) => {
    if (command.action === 'move') {
        await page.mouse.move(command.x ?? 0, command.y ?? 0);
        return;
    }

    if (command.action === 'down') {
        await page.mouse.down({
            button: command.button ?? 'left',
        });
        return;
    }

    if (command.action === 'up') {
        await page.mouse.up({
            button: command.button ?? 'left',
        });
        return;
    }

    await page.mouse.wheel({
        deltaX: command.deltaX ?? 0,
        deltaY: command.deltaY ?? 0,
    });
};

const executeKeyboardCommand = async (
    page: Page,
    command: Extract<PortalExecutableCommand, { type: 'input.keyboard' }>,
) => {
    const key = command.key as Parameters<Page['keyboard']['down']>[0];

    if (command.action === 'down') {
        await page.keyboard.down(key);
        return;
    }

    if (command.action === 'up') {
        await page.keyboard.up(key);
        return;
    }

    await page.keyboard.press(key);
};

export const createPuppeteerPortalBackend = ({ page$, resolvePage }: PuppeteerPageResolver): PortalBackend => {
    let activeView: PortalViewSource | null = null;

    const getLocation = async () => {
        const page = await resolvePage();
        if (page === null || page.isClosed()) {
            return null;
        }

        return page.url();
    };

    const execute = async (command: PortalExecutableCommand) => {
        const page = await resolvePageOrFail(resolvePage);

        try {
            switch (command.type) {
                case 'navigate.goto': {
                    await page.goto(command.url);
                    return;
                }
                case 'navigate.reload': {
                    await page.reload();
                    return;
                }
                case 'navigate.back': {
                    await page.goBack();
                    return;
                }
                case 'navigate.forward': {
                    await page.goForward();
                    return;
                }
                case 'input.click': {
                    await page.mouse.click(command.x, command.y, {
                        button: command.button ?? 'left',
                        count: command.clickCount,
                    });
                    return;
                }
                case 'input.type': {
                    await page.keyboard.type(command.text);
                    return;
                }
                case 'input.mouse': {
                    await executeMouseCommand(page, command);
                    return;
                }
                case 'input.keyboard': {
                    await executeKeyboardCommand(page, command);
                    break;
                }
            }
        } catch (error) {
            throw normalizePortalBackendError(error);
        }
    };

    const stopView = async () => {
        if (activeView === null) {
            return;
        }

        const current = activeView;
        activeView = null;
        await current.stop();
    };

    const startView = async (): Promise<PortalViewSource> => {
        if (activeView !== null) {
            return activeView;
        }

        const page = await resolvePageOrFail(resolvePage);
        let cdpSession: CDPSession;

        try {
            cdpSession = await page.createCDPSession();
        } catch (error) {
            throw new PortalBackendError('UNSUPPORTED_BACKEND', 'Puppeteer backend does not support CDP', {
                cause: error,
            });
        }

        const frames$ = new Observable<PortalViewFrame>((subscriber) => {
            const onFrame = (event: { data: string; metadata?: unknown; sessionId: number }) => {
                const frameId = nextFrameId();
                subscriber.next({
                    frameId,
                    format: 'jpeg',
                    metadata: event.metadata,
                    payload: Uint8Array.from(Buffer.from(event.data, 'base64')),
                    ack: async () => {
                        await cdpSession.send('Page.screencastFrameAck', {
                            sessionId: event.sessionId,
                        });
                    },
                });
            };
            const onDetached = () => {
                subscriber.complete();
            };

            cdpSession.on('Page.screencastFrame', onFrame);
            cdpSession.on('Detached', onDetached);
            void cdpSession
                .send('Page.startScreencast', {
                    format: 'jpeg',
                    everyNthFrame: 1,
                    quality: 80,
                })
                .catch((error: unknown) => subscriber.error(normalizePortalBackendError(error)));

            return () => {
                cdpSession.off('Page.screencastFrame', onFrame);
                cdpSession.off('Detached', onDetached);
            };
        });

        activeView = {
            frames$,
            stop: async () => {
                try {
                    await cdpSession.send('Page.stopScreencast');
                } catch {}

                try {
                    await cdpSession.detach();
                } catch {}
            },
        };

        return activeView;
    };

    return {
        location$: observeLocation(page$),
        getLocation,
        execute,
        startView,
        stopView,
    };
};
