// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { App } from './App';
import type { UsePortalSessionResult } from './use-portal-session';

const createSession = (overrides: Partial<UsePortalSessionResult> = {}): UsePortalSessionResult => ({
    click: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    connectionIssue: null,
    connectionState: 'closed',
    disconnect: vi.fn(async () => {}),
    frame: null,
    goBack: vi.fn(async () => {}),
    goForward: vi.fn(async () => {}),
    goto: vi.fn(async () => {}),
    hello: null,
    initialize: vi.fn(async () => {}),
    keyboard: vi.fn(async () => {}),
    latestError: null,
    location: null,
    mouse: vi.fn(async () => {}),
    pageState: null,
    recentEvents: [],
    reload: vi.fn(async () => {}),
    startView: vi.fn(async () => {}),
    stopView: vi.fn(async () => {}),
    type: vi.fn(async () => {}),
    ...overrides,
});

afterEach(() => {
    cleanup();
    delete (window as Window & { __PORTAL_CLIENT_EXAMPLE_CONFIG__?: unknown }).__PORTAL_CLIENT_EXAMPLE_CONFIG__;
    vi.unstubAllGlobals();
});

beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        () =>
            ({
                bottom: 400,
                height: 400,
                left: 0,
                right: 800,
                toJSON: () => {},
                top: 0,
                width: 800,
                x: 0,
                y: 0,
            }) as DOMRect,
    );
    if (!('scrollIntoView' in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: vi.fn(),
        });
    } else {
        vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    }
});

describe('App', () => {
    it('passes the typed websocket url through unchanged', async () => {
        const connect = vi.fn(async () => {});
        const useSession = () =>
            createSession({
                connect,
            });

        render(<App useSession={useSession} />);

        const portalUrl = screen.getByRole('textbox', { name: 'Portal URL' });
        fireEvent.change(portalUrl, { target: { value: 'ws://localhost:8005/portal' } });
        fireEvent.click(screen.getByRole('button', { name: 'connect' }));

        await waitFor(() => {
            expect(connect).toHaveBeenCalledWith('ws://localhost:8005/portal');
        });

        expect(screen.queryByRole('heading', { name: 'portal client example' })).toBeNull();
        expect(screen.queryByRole('heading', { name: 'browser view' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'create page' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'start view' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'stop view' })).toBeNull();
        expect(screen.queryByText('portal url')).toBeNull();
        expect(screen.queryByText('recent events')).toBeNull();
    });

    it('hides the portal input and auto-connects when embedded config is injected', async () => {
        const connect = vi.fn(async () => {});
        const useSession = () =>
            createSession({
                connect,
            });

        Object.defineProperty(window, '__PORTAL_CLIENT_EXAMPLE_CONFIG__', {
            configurable: true,
            value: {
                hidePortalInput: true,
                portalUrl: '/portal',
            },
            writable: true,
        });

        render(<App useSession={useSession} />);

        await waitFor(() => {
            expect(connect).toHaveBeenCalledWith('/portal');
        });

        expect(screen.queryByRole('textbox', { name: 'Portal URL' })).toBeNull();
        expect(screen.getByText('embedded portal session')).toBeTruthy();
    });

    it('shows the events popup on hover and keeps it open when pinned', async () => {
        const useSession = () =>
            createSession({
                connectionState: 'open',
                recentEvents: [
                    {
                        id: 'event-1',
                        summary: 'hello v1',
                        type: 'hello',
                    },
                ],
            });

        render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('recent events')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'pin events' }));
        fireEvent.mouseLeave(screen.getByTestId('events-toolbar-trigger'));
        expect(screen.getByText('recent events')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'close events' }));
        await waitFor(() => {
            expect(screen.queryByText('recent events')).toBeNull();
        });
    });

    it('renders sent and received events together in the list', async () => {
        const useSession = () =>
            createSession({
                connectionState: 'open',
                recentEvents: [
                    {
                        direction: 'sent',
                        id: 'event-1',
                        summary: 'sent navigate.goto',
                        type: 'navigate.goto',
                    },
                    {
                        direction: 'received',
                        id: 'event-2',
                        summary: 'hello v1',
                        type: 'hello',
                    },
                ],
            });

        render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('recent events')).toBeTruthy();
        });

        expect(screen.getByText('sent')).toBeTruthy();
        expect(screen.getByText('received')).toBeTruthy();
        expect(screen.getByText('navigate.goto')).toBeTruthy();
        expect(screen.getByText('hello v1')).toBeTruthy();
    });

    it('keeps scroll position stable when new events are prepended', async () => {
        let currentSession = createSession({
            connectionState: 'open',
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
                {
                    id: 'event-2',
                    summary: 'custom alpha',
                    type: 'custom.alpha',
                },
                {
                    id: 'event-3',
                    summary: 'custom beta',
                    type: 'custom.beta',
                },
            ],
        });
        const useSession = () => currentSession;
        const view = render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('recent events')).toBeTruthy();
        });

        const scrollContainer = screen.getByTestId('events-scroll');
        scrollContainer.scrollTop = 120;

        currentSession = createSession({
            connectionState: 'open',
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
                {
                    id: 'event-2',
                    summary: 'custom alpha',
                    type: 'custom.alpha',
                },
                {
                    id: 'event-3',
                    summary: 'custom beta',
                    type: 'custom.beta',
                },
                {
                    id: 'event-4',
                    summary: 'custom gamma',
                    type: 'custom.gamma',
                },
            ],
        });
        view.rerender(<App useSession={useSession} />);

        expect(scrollContainer.scrollTop).toBeGreaterThan(120);
    });

    it('shows event filters by default and adds newly seen event types to the checklist', async () => {
        let currentSession = createSession({
            connectionState: 'open',
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
            ],
        });
        const useSession = () => currentSession;
        const view = render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('recent events')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'filter types' }));
        await waitFor(() => {
            expect(screen.getByLabelText('hello')).toBeTruthy();
        });
        expect((screen.getByLabelText('hello') as HTMLInputElement).checked).toBe(true);
        expect((screen.getByLabelText('command.error') as HTMLInputElement).checked).toBe(true);
        expect(screen.getByText('hello v1')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'filter types' }));
        await waitFor(() => {
            expect(screen.queryByLabelText('hello')).toBeNull();
        });
        expect(screen.getByText('recent events')).toBeTruthy();
        expect(screen.getByText('hello v1')).toBeTruthy();

        currentSession = createSession({
            connectionState: 'open',
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
                {
                    id: 'event-2',
                    summary: 'custom alpha',
                    type: 'custom.alpha',
                },
            ],
        });
        view.rerender(<App useSession={useSession} />);

        expect(screen.getByText('recent events')).toBeTruthy();
        expect(screen.getByText('hello v1')).toBeTruthy();
        expect(screen.getByText('custom alpha')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'filter types' }));
        await waitFor(() => {
            expect(screen.getByLabelText('custom.alpha')).toBeTruthy();
        });
        expect((screen.getByLabelText('custom.alpha') as HTMLInputElement).checked).toBe(true);
    });

    it('hides matching event items when a filter checkbox is enabled', async () => {
        const useSession = () =>
            createSession({
                connectionState: 'open',
                recentEvents: [
                    {
                        id: 'event-1',
                        summary: 'hello v1',
                        type: 'hello',
                    },
                    {
                        id: 'event-2',
                        summary: 'custom alpha',
                        type: 'custom.alpha',
                    },
                ],
            });

        render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('recent events')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'filter types' }));
        await waitFor(() => {
            expect(screen.getByLabelText('hello')).toBeTruthy();
        });
        expect(screen.getByText('hello v1')).toBeTruthy();
        expect(screen.getByText('custom alpha')).toBeTruthy();

        fireEvent.click(screen.getByLabelText('hello'));
        expect((screen.getByLabelText('hello') as HTMLInputElement).checked).toBe(false);

        await waitFor(() => {
            expect(screen.queryByText('hello v1')).toBeNull();
        });
    });

    it('freezes the visible event list while paused even if new events arrive', async () => {
        let currentSession = createSession({
            connectionState: 'open',
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
                {
                    id: 'event-2',
                    summary: 'custom alpha',
                    type: 'custom.alpha',
                },
            ],
        });
        const useSession = () => currentSession;
        const view = render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('recent events')).toBeTruthy();
        });

        fireEvent.click(screen.getByLabelText('pause updates'));

        currentSession = createSession({
            connectionState: 'open',
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
                {
                    id: 'event-2',
                    summary: 'custom alpha',
                    type: 'custom.alpha',
                },
                {
                    id: 'event-3',
                    summary: 'custom beta',
                    type: 'custom.beta',
                },
            ],
        });
        view.rerender(<App useSession={useSession} />);

        expect(screen.getByText('recent events')).toBeTruthy();
        expect(screen.getByText('hello v1')).toBeTruthy();
        expect(screen.getByText('custom alpha')).toBeTruthy();
        expect(screen.queryByText('custom beta')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'filter types' }));
        await waitFor(() => {
            expect(screen.getByLabelText('custom.beta')).toBeTruthy();
        });
        expect((screen.getByLabelText('custom.beta') as HTMLInputElement).checked).toBe(true);
    });

    it('normalizes navigation urls before goto', async () => {
        const goto = vi.fn(async () => {});
        const useSession = () =>
            createSession({
                goto,
            });

        render(<App useSession={useSession} />);

        const address = screen.getByRole('textbox', { name: 'Address' });
        const form = address.closest('form');

        if (!form) {
            throw new Error('Address form not found');
        }

        fireEvent.change(address, { target: { value: 'example.com/p/portal/' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(goto).toHaveBeenCalledWith('https://example.com/p/portal/');
        });

        fireEvent.change(address, { target: { value: '/p/portal/' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(goto).toHaveBeenLastCalledWith(new URL('/p/portal/', window.location.origin).toString());
        });
    });

    it('shows browser navigation state and session errors', async () => {
        let currentSession = createSession({
            connectionState: 'open',
            latestError: {
                code: 'NO_ACTIVE_PAGE',
                message: 'No active page is available',
                requestId: 'req-1',
            },
            location: 'https://example.com/p/portal/',
            pageState: {
                hasPage: false,
            },
        });
        const useSession = () => currentSession;
        const view = render(<App useSession={useSession} />);

        fireEvent.mouseEnter(screen.getByTestId('status-toolbar-trigger'));
        await waitFor(() => {
            expect(screen.getByText('https://example.com/p/portal/')).toBeTruthy();
        });
        expect(screen.getByText('NO_ACTIVE_PAGE')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(false);

        expect(screen.getByText('portal url')).toBeTruthy();
        expect(screen.getByText('page state')).toBeTruthy();
        expect(screen.getByText('NO_ACTIVE_PAGE')).toBeTruthy();

        currentSession = createSession({
            connectionState: 'open',
            frame: {
                format: 'jpeg',
                frameId: 'frame-1',
                metadata: {
                    deviceHeight: 360,
                    deviceWidth: 640,
                },
                payload: new Uint8Array([255, 216, 255, 217]),
            },
            hello: {
                capabilities: ['navigate.goto'],
                extensions: ['app.createPage'],
                protocolVersion: 1,
            },
            latestError: {
                code: 'NO_ACTIVE_PAGE',
                message: 'No active page is available',
                requestId: 'req-1',
            },
            location: 'https://example.com/p/portal/',
            pageState: {
                hasPage: true,
            },
            recentEvents: [
                {
                    id: 'event-1',
                    summary: 'hello v1',
                    type: 'hello',
                },
            ],
        });
        view.rerender(<App useSession={useSession} />);

        await waitFor(() => {
            expect(screen.getByRole('img', { name: 'Live browser frame' })).toBeTruthy();
        });

        fireEvent.mouseEnter(screen.getByTestId('events-toolbar-trigger'));
        expect(screen.getByText('recent events')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'filter types' }));
        expect(screen.getByText('hello v1')).toBeTruthy();
    });
});
