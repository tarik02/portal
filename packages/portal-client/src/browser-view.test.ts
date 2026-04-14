import { describe, expect, it } from 'vite-plus/test';

import {
    createPortalBrowserViewImageBlob,
    createPortalBrowserViewImageDataUrl,
    createPortalBrowserViewKeyboardCommand,
    createPortalBrowserViewKeyboardWireInput,
    createPortalBrowserViewMouseCommand,
    createPortalBrowserViewMouseWireInput,
    createPortalBrowserViewTypeCommand,
    createPortalBrowserViewWheelWireInput,
    getPortalBrowserViewSize,
    isPortalBrowserViewFrameMetadata,
} from './browser-view';

const asMouseEvent = (value: Partial<MouseEvent> & Pick<MouseEvent, 'type' | 'button' | 'clientX' | 'clientY'>) =>
    value as MouseEvent;

const asWheelEvent = (
    value: Partial<WheelEvent> & Pick<WheelEvent, 'type' | 'button' | 'clientX' | 'clientY' | 'deltaX' | 'deltaY'>,
) => value as WheelEvent;

const asKeyboardEvent = (value: Partial<KeyboardEvent> & Pick<KeyboardEvent, 'type' | 'key'>) => value as KeyboardEvent;

describe('portal browser view primitives', () => {
    it('detects frame metadata and exposes its size', () => {
        const metadata = {
            deviceWidth: 1280,
            deviceHeight: 720,
            pageScaleFactor: 1,
        };

        expect(isPortalBrowserViewFrameMetadata(metadata)).toBe(true);
        expect(getPortalBrowserViewSize(metadata)).toEqual({
            width: 1280,
            height: 720,
        });
        expect(getPortalBrowserViewSize()).toBeUndefined();
    });

    it('converts mouse and wheel events into scaled wire inputs', () => {
        const metadata = {
            deviceWidth: 1000,
            deviceHeight: 500,
        };

        expect(
            createPortalBrowserViewMouseWireInput({
                event: asMouseEvent({
                    type: 'mousemove',
                    button: 0,
                    clientX: 110,
                    clientY: 70,
                }),
                bounds: {
                    left: 10,
                    top: 20,
                    width: 200,
                    height: 100,
                },
                metadata,
            }),
        ).toEqual({
            action: 'move',
            x: 500,
            y: 250,
            button: 'left',
        });

        expect(
            createPortalBrowserViewWheelWireInput({
                event: asWheelEvent({
                    type: 'wheel',
                    button: 0,
                    clientX: 230,
                    clientY: 150,
                    deltaX: 10,
                    deltaY: -20,
                }),
                bounds: {
                    left: 10,
                    top: 20,
                    width: 200,
                    height: 100,
                },
                metadata,
            }),
        ).toEqual({
            action: 'wheel',
            x: 1000,
            y: 500,
            deltaX: 10,
            deltaY: -20,
        });

        expect(
            createPortalBrowserViewMouseCommand({
                event: asMouseEvent({
                    type: 'mousemove',
                    button: 0,
                    clientX: 110,
                    clientY: 70,
                }),
                bounds: {
                    left: 10,
                    top: 20,
                    width: 200,
                    height: 100,
                },
                metadata,
            }),
        ).toEqual({
            type: 'input.mouse',
            action: 'move',
            x: 500,
            y: 250,
            button: 'left',
        });
    });

    it('converts keyboard and type input into wire inputs and commands', () => {
        expect(
            createPortalBrowserViewKeyboardWireInput(
                asKeyboardEvent({
                    type: 'keydown',
                    key: 'a',
                }),
            ),
        ).toEqual({
            action: 'down',
            key: 'a',
            text: 'a',
        });

        expect(
            createPortalBrowserViewKeyboardWireInput(
                asKeyboardEvent({
                    type: 'keyup',
                    key: 'Enter',
                }),
            ),
        ).toEqual({
            action: 'up',
            key: 'Enter',
        });

        expect(
            createPortalBrowserViewKeyboardWireInput(
                asKeyboardEvent({
                    type: 'keypress',
                    key: 'a',
                }),
            ),
        ).toBeUndefined();

        expect(
            createPortalBrowserViewKeyboardCommand(
                asKeyboardEvent({
                    type: 'keydown',
                    key: 'a',
                }),
            ),
        ).toEqual({
            type: 'input.keyboard',
            action: 'down',
            key: 'a',
            text: 'a',
        });

        expect(createPortalBrowserViewTypeCommand('hello')).toEqual({
            type: 'input.type',
            text: 'hello',
        });
    });

    it('ignores composing keyboard events', () => {
        expect(
            createPortalBrowserViewKeyboardWireInput(
                asKeyboardEvent({
                    type: 'keydown',
                    key: 'a',
                    isComposing: true,
                }),
            ),
        ).toBeUndefined();
    });

    it('converts frames into browser image payloads', async () => {
        const frame = {
            format: 'jpeg' as const,
            payload: new Uint8Array([1, 2, 3]),
        };

        const blob = createPortalBrowserViewImageBlob(frame);

        expect(blob.type).toBe('image/jpeg');
        expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
        expect(createPortalBrowserViewImageDataUrl(frame)).toBe('data:image/jpeg;base64,AQID');
    });
});
