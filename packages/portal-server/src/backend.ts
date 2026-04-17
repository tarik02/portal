import type { Observable } from 'rxjs';

import type { PortalErrorCode, PortalExecutableCommand } from '@tarik02/portal-core';

export class PortalBackendError extends Error {
    public readonly code: PortalErrorCode;

    public constructor(code: PortalErrorCode, message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'PortalBackendError';
        this.code = code;
    }
}

export type PortalViewFrame = {
    frameId: string;
    format: 'jpeg';
    metadata?: unknown;
    payload: Uint8Array;
    ack: () => Promise<void>;
};

export interface PortalViewSource {
    readonly frames$: Observable<PortalViewFrame>;
    stop(): Promise<void>;
}

export interface PortalBackend {
    readonly location$: Observable<string>;
    getLocation(): Promise<string | null>;
    execute(command: PortalExecutableCommand): Promise<void>;
    startView(): Promise<PortalViewSource>;
    stopView(): Promise<void>;
}

const isTargetClosedMessage = (message: string) => /target closed|page closed|browser has disconnected/i.test(message);

export const normalizePortalBackendError = (error: unknown): PortalBackendError => {
    if (error instanceof PortalBackendError) {
        return error;
    }

    if (error instanceof Error && isTargetClosedMessage(error.message)) {
        return new PortalBackendError('TARGET_CLOSED', 'Browser target is closed', {
            cause: error,
        });
    }

    if (error instanceof Error) {
        return new PortalBackendError('COMMAND_FAILED', error.message, {
            cause: error,
        });
    }

    return new PortalBackendError('COMMAND_FAILED', 'Portal command failed', {
        cause: error,
    });
};
