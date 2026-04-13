import { fromByteArray } from 'base64-js';
import type { PortalClientCommand, PortalInputKeyboardCommand, PortalInputMouseCommand } from '@tarik02/portal-core';

import type { PortalClientFrame } from './client';

export type PortalBrowserViewFrameMetadata = {
    deviceWidth: number;
    deviceHeight: number;
    pageScaleFactor?: number;
    offsetTop?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
};

export type PortalBrowserViewBounds = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type PortalBrowserViewMouseWireInput = Omit<PortalInputMouseCommand, 'requestId' | 'type'>;

export type PortalBrowserViewKeyboardWireInput = Omit<PortalInputKeyboardCommand, 'requestId' | 'type'>;

const mouseActionByType: Record<
    'mousedown' | 'mousemove' | 'mouseup' | 'wheel',
    Extract<PortalClientCommand, { type: 'input.mouse' }>['action']
> = {
    mousedown: 'down',
    mousemove: 'move',
    mouseup: 'up',
    wheel: 'wheel',
};

const buttonByIndex: Record<number, 'left' | 'middle' | 'right'> = {
    0: 'left',
    1: 'middle',
    2: 'right',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isWheelEvent = (event: MouseEvent | WheelEvent): event is WheelEvent => event.type === 'wheel';

const isPortalMouseEventType = (value: string): value is keyof typeof mouseActionByType => value in mouseActionByType;

const getPortalImageMimeType = (format: PortalClientFrame['format']) => {
    switch (format) {
        case 'jpeg': {
            return 'image/jpeg';
        }
    }
};

const getRemotePoint = ({
    clientX,
    clientY,
    bounds,
    metadata,
}: {
    clientX: number;
    clientY: number;
    bounds: PortalBrowserViewBounds;
    metadata: PortalBrowserViewFrameMetadata;
}) => {
    const x = clamp(clientX - bounds.left, 0, bounds.width);
    const y = clamp(clientY - bounds.top, 0, bounds.height);

    return {
        x: Math.round((x / bounds.width) * metadata.deviceWidth),
        y: Math.round((y / bounds.height) * metadata.deviceHeight),
    };
};

const isPrintableKey = (key: string) => key.length === 1;

export const isPortalBrowserViewFrameMetadata = (value: unknown): value is PortalBrowserViewFrameMetadata =>
    isRecord(value) && isFiniteNumber(value.deviceWidth) && isFiniteNumber(value.deviceHeight);

export const getPortalBrowserViewSize = (metadata?: unknown) => {
    if (!isPortalBrowserViewFrameMetadata(metadata)) {
        return;
    }

    return {
        width: metadata.deviceWidth,
        height: metadata.deviceHeight,
    };
};

export const createPortalBrowserViewMouseCommand = ({
    event,
    bounds,
    metadata,
}: {
    event: MouseEvent | WheelEvent;
    bounds: PortalBrowserViewBounds;
    metadata: unknown;
}): Omit<Extract<PortalClientCommand, { type: 'input.mouse' }>, 'requestId'> | undefined => {
    const input = isWheelEvent(event)
        ? createPortalBrowserViewWheelWireInput({
              event,
              bounds,
              metadata,
          })
        : createPortalBrowserViewMouseWireInput({
              event,
              bounds,
              metadata,
          });
    if (!input) {
        return undefined;
    }

    return {
        type: 'input.mouse',
        ...input,
    };
};

export const createPortalBrowserViewMouseWireInput = ({
    event,
    bounds,
    metadata,
}: {
    event: MouseEvent;
    bounds: PortalBrowserViewBounds;
    metadata: unknown;
}): PortalBrowserViewMouseWireInput | undefined => {
    if (!isPortalBrowserViewFrameMetadata(metadata) || bounds.width <= 0 || bounds.height <= 0) {
        return undefined;
    }

    if (!isPortalMouseEventType(event.type) || event.type === 'wheel') {
        return undefined;
    }

    const point = getRemotePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds,
        metadata,
    });

    return {
        action: mouseActionByType[event.type],
        x: point.x,
        y: point.y,
        button: buttonByIndex[event.button],
    };
};

export const createPortalBrowserViewWheelWireInput = ({
    event,
    bounds,
    metadata,
}: {
    event: WheelEvent;
    bounds: PortalBrowserViewBounds;
    metadata: unknown;
}): PortalBrowserViewMouseWireInput | undefined => {
    if (!isPortalBrowserViewFrameMetadata(metadata) || bounds.width <= 0 || bounds.height <= 0) {
        return undefined;
    }

    const point = getRemotePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds,
        metadata,
    });

    return {
        action: 'wheel',
        x: point.x,
        y: point.y,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
    };
};

export const createPortalBrowserViewKeyboardCommand = (
    event: KeyboardEvent,
): Omit<Extract<PortalClientCommand, { type: 'input.keyboard' }>, 'requestId'> | undefined => {
    const input = createPortalBrowserViewKeyboardWireInput(event);
    if (!input) {
        return undefined;
    }

    return {
        type: 'input.keyboard',
        ...input,
    };
};

export const createPortalBrowserViewKeyboardWireInput = (
    event: KeyboardEvent,
): PortalBrowserViewKeyboardWireInput | undefined => {
    if (event.isComposing) {
        return undefined;
    }

    switch (event.type) {
        case 'keydown': {
            return {
                action: 'down',
                key: event.key,
                ...(isPrintableKey(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey
                    ? { text: event.key }
                    : {}),
            };
        }
        case 'keyup': {
            return {
                action: 'up',
                key: event.key,
            };
        }
        case 'keypress': {
            return undefined;
        }
    }
};

export const createPortalBrowserViewTypeCommand = (
    text: string,
): Omit<Extract<PortalClientCommand, { type: 'input.type' }>, 'requestId'> => ({
    type: 'input.type',
    text,
});

export const createPortalBrowserViewImageBlob = (frame: Pick<PortalClientFrame, 'format' | 'payload'>) => {
    const payload = new Uint8Array(frame.payload.length);
    payload.set(frame.payload);

    return new Blob([payload], {
        type: getPortalImageMimeType(frame.format),
    });
};

export const createPortalBrowserViewImageDataUrl = (frame: Pick<PortalClientFrame, 'format' | 'payload'>) =>
    `data:${getPortalImageMimeType(frame.format)};base64,${fromByteArray(frame.payload)}`;
