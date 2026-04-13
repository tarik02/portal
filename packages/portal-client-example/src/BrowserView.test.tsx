// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { BrowserView, resolveBrowserViewShellWidth } from './BrowserView';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('BrowserView', () => {
    it('shrinks the browser shell width to fit the available height while preserving aspect ratio', () => {
        expect(
            resolveBrowserViewShellWidth({
                aspectRatio: 16 / 10,
                viewportHeight: 400,
                viewportWidth: 1200,
            }),
        ).toBe(640);

        expect(
            resolveBrowserViewShellWidth({
                aspectRatio: 16 / 10,
                viewportHeight: 400,
                viewportWidth: 500,
            }),
        ).toBe(500);
    });

    it('renders a disconnected placeholder', () => {
        render(<BrowserView connectionState="closed" frame={null} />);

        expect(screen.getByText('Connect to a worker to start the browser view.')).toBeTruthy();
    });

    it('renders an empty connected placeholder before the first frame', () => {
        render(<BrowserView connectionState="open" frame={null} />);

        expect(screen.getByText('The session is live. Start the view stream to receive frames.')).toBeTruthy();
    });

    it('renders a frame with metadata-derived aspect ratio', () => {
        render(
            <BrowserView
                connectionState="open"
                frame={{
                    format: 'jpeg',
                    frameId: 'frame-1',
                    metadata: {
                        deviceHeight: 600,
                        deviceWidth: 800,
                    },
                    payload: new Uint8Array([255, 216, 255, 217]),
                }}
            />,
        );

        const shell = screen.getByTestId('browser-view-shell');
        const image = screen.getByRole('img', {
            name: 'Live browser frame',
        });

        expect(shell).toBeTruthy();
        expect((shell as HTMLElement).style.aspectRatio).toBe('800 / 600');
        expect(image.getAttribute('src')).toContain('data:image/jpeg;base64,');
    });

    it('falls back to the default aspect ratio when metadata is invalid', () => {
        render(
            <BrowserView
                connectionState="open"
                frame={{
                    format: 'jpeg',
                    frameId: 'frame-2',
                    metadata: {
                        width: 800,
                    },
                    payload: new Uint8Array([1, 2, 3]),
                }}
            />,
        );

        expect((screen.getByTestId('browser-view-shell') as HTMLElement).style.aspectRatio).toBe('16 / 10');
    });

    it('sends mouse, keyboard, and type commands from the browser shell', async () => {
        const sendMouseCommand = vi.fn(async () => {});
        const sendKeyboardCommand = vi.fn(async () => {});
        const sendTypeCommand = vi.fn(async () => {});

        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            bottom: 600,
            height: 600,
            left: 0,
            right: 800,
            toJSON: () => {},
            top: 0,
            width: 800,
            x: 0,
            y: 0,
        } as DOMRect);

        render(
            <BrowserView
                connectionState="open"
                frame={{
                    format: 'jpeg',
                    frameId: 'frame-3',
                    metadata: {
                        deviceHeight: 600,
                        deviceWidth: 800,
                    },
                    payload: new Uint8Array([255, 216, 255, 217]),
                }}
                sendKeyboardCommand={sendKeyboardCommand}
                sendMouseCommand={sendMouseCommand}
                sendTypeCommand={sendTypeCommand}
            />,
        );

        const shell = screen.getByTestId('browser-view-shell');
        fireEvent.mouseDown(shell, { button: 0, clientX: 16, clientY: 32 });
        fireEvent.mouseUp(shell, { button: 0, clientX: 16, clientY: 32 });
        fireEvent.keyDown(shell, { key: 'a' });
        fireEvent.keyUp(shell, { key: 'a' });
        fireEvent.paste(shell, {
            clipboardData: {
                getData: (type: string) => (type === 'text/plain' ? 'hello' : ''),
            },
        });

        await waitFor(() => {
            expect(sendMouseCommand).toHaveBeenCalled();
            expect(sendKeyboardCommand).toHaveBeenCalled();
            expect(sendTypeCommand).toHaveBeenCalled();
        });

        expect(sendMouseCommand).toHaveBeenCalledWith({
            action: 'down',
            button: 'left',
            type: 'input.mouse',
            x: 16,
            y: 32,
        });
        expect(sendKeyboardCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'down',
                key: 'a',
                text: 'a',
                type: 'input.keyboard',
            }),
        );
        expect(sendTypeCommand).toHaveBeenCalledWith({
            text: 'hello',
            type: 'input.type',
        });
    });
});
