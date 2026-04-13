export type PortalConnectionState = 'connecting' | 'open' | 'closed';

export type PortalHelloState = {
    protocolVersion: number;
    capabilities: string[];
    extensions: string[];
};

export type PortalPageState = {
    hasPage: boolean;
};

export type PortalCommandErrorState = {
    requestId: string;
    code: string;
    message: string;
};

export type PortalRecentEventDirection = 'received' | 'sent';

export type PortalRecentEvent = {
    id: string;
    type: string;
    summary: string;
    direction?: PortalRecentEventDirection;
};

export type PortalDerivedState = {
    hello: PortalHelloState | null;
    latestError: PortalCommandErrorState | null;
    pageState: PortalPageState | null;
    recentEvents: PortalRecentEvent[];
};

export const MAX_RECENT_EVENTS = 10_000;
export const DEFAULT_RECENT_EVENT_TYPES = [
    'hello',
    'location.changed',
    'view.frame-meta',
    'command.result',
    'command.error',
    'app.pageState',
] as const;

export const initialPortalDerivedState: PortalDerivedState = {
    hello: null,
    latestError: null,
    pageState: null,
    recentEvents: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const getEventType = (value: unknown) => {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return 'unknown';
    }

    return value.type;
};

const safeJson = (value: unknown) => {
    try {
        return JSON.stringify(value);
    } catch {
        return '[unserializable event]';
    }
};

const formatPortalCommandSummary = (value: unknown) => {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return safeJson(value);
    }

    if (value.type === 'navigate.goto' && typeof value.url === 'string') {
        return value.url;
    }

    if (value.type === 'input.type' && typeof value.text === 'string') {
        return value.text;
    }

    if ('payload' in value) {
        return safeJson(value.payload);
    }

    const { requestId: _requestId, type: _type, ...payload } = value;
    const payloadText = safeJson(payload);

    return payloadText === '{}' ? value.type : payloadText;
};

export const getRecentEventTypeOptions = (events: PortalRecentEvent[]) => {
    const types: string[] = [...DEFAULT_RECENT_EVENT_TYPES];

    for (const event of events) {
        if (types.includes(event.type)) {
            continue;
        }

        types.push(event.type);
    }

    return types;
};

export const getVisibleRecentEvents = (events: PortalRecentEvent[], hiddenTypes: ReadonlySet<string>) =>
    events.filter((event) => !hiddenTypes.has(event.type));

export const readHelloEvent = (value: unknown): PortalHelloState | null => {
    if (!isRecord(value) || value.type !== 'hello') {
        return null;
    }

    if (!isNumber(value.protocolVersion) || !isStringArray(value.capabilities) || !isStringArray(value.extensions)) {
        return null;
    }

    return {
        protocolVersion: value.protocolVersion,
        capabilities: value.capabilities,
        extensions: value.extensions,
    };
};

const readPageStateEvent = (value: unknown): PortalPageState | null => {
    if (!isRecord(value) || value.type !== 'app.pageState' || !isRecord(value.payload)) {
        return null;
    }

    if (typeof value.payload.hasPage !== 'boolean') {
        return null;
    }

    return {
        hasPage: value.payload.hasPage,
    };
};

export const readCommandErrorEvent = (value: unknown): PortalCommandErrorState | null => {
    if (!isRecord(value) || value.type !== 'command.error') {
        return null;
    }

    if (typeof value.requestId !== 'string' || typeof value.code !== 'string' || typeof value.message !== 'string') {
        return null;
    }

    return {
        requestId: value.requestId,
        code: value.code,
        message: value.message,
    };
};

const formatPortalEventSummary = (value: unknown) => {
    const hello = readHelloEvent(value);
    if (hello) {
        return `hello v${hello.protocolVersion}`;
    }

    const pageState = readPageStateEvent(value);
    if (pageState) {
        return pageState.hasPage ? 'page available' : 'page unavailable';
    }

    const commandError = readCommandErrorEvent(value);
    if (commandError) {
        return `${commandError.code}: ${commandError.message}`;
    }

    return safeJson(value);
};

const appendRecentEvent = (events: PortalRecentEvent[], value: unknown): PortalRecentEvent[] =>
    [
        ...events,
        {
            id: globalThis.crypto.randomUUID(),
            type: getEventType(value),
            summary: formatPortalEventSummary(value),
            direction: 'received' as const,
        },
    ].slice(-MAX_RECENT_EVENTS);

const appendRecentSentCommand = (events: PortalRecentEvent[], value: unknown): PortalRecentEvent[] =>
    [
        ...events,
        {
            id: globalThis.crypto.randomUUID(),
            type: getEventType(value),
            summary: formatPortalCommandSummary(value),
            direction: 'sent' as const,
        },
    ].slice(-MAX_RECENT_EVENTS);

export const applyPortalEvent = (state: PortalDerivedState, value: unknown): PortalDerivedState => ({
    hello: readHelloEvent(value) ?? state.hello,
    latestError: readCommandErrorEvent(value) ?? state.latestError,
    pageState: readPageStateEvent(value) ?? state.pageState,
    recentEvents: appendRecentEvent(state.recentEvents, value),
});

export const appendPortalSentCommand = (events: PortalRecentEvent[], value: unknown) =>
    appendRecentSentCommand(events, value);
