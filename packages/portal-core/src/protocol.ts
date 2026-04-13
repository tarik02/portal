export const PORTAL_PROTOCOL_VERSION = 1 as const;

export type PortalNavigateGotoCommand = {
    requestId: string;
    type: 'navigate.goto';
    url: string;
};

export type PortalNavigateReloadCommand = {
    requestId: string;
    type: 'navigate.reload';
};

export type PortalNavigateBackCommand = {
    requestId: string;
    type: 'navigate.back';
};

export type PortalNavigateForwardCommand = {
    requestId: string;
    type: 'navigate.forward';
};

export type PortalInputClickCommand = {
    requestId: string;
    type: 'input.click';
    x: number;
    y: number;
    button?: 'left' | 'middle' | 'right';
    clickCount?: number;
};

export type PortalInputTypeCommand = {
    requestId: string;
    type: 'input.type';
    text: string;
};

export type PortalInputMouseCommand = {
    requestId: string;
    type: 'input.mouse';
    action: 'move' | 'down' | 'up' | 'wheel';
    x?: number;
    y?: number;
    button?: 'left' | 'middle' | 'right';
    deltaX?: number;
    deltaY?: number;
};

export type PortalInputKeyboardCommand = {
    requestId: string;
    type: 'input.keyboard';
    action: 'down' | 'up' | 'press';
    key: string;
    text?: string;
};

export type PortalViewStartCommand = {
    requestId: string;
    type: 'view.start';
};

export type PortalViewStopCommand = {
    requestId: string;
    type: 'view.stop';
};

export type PortalCommand =
    | PortalNavigateGotoCommand
    | PortalNavigateReloadCommand
    | PortalNavigateBackCommand
    | PortalNavigateForwardCommand
    | PortalInputClickCommand
    | PortalInputTypeCommand
    | PortalInputMouseCommand
    | PortalInputKeyboardCommand
    | PortalViewStartCommand
    | PortalViewStopCommand;

export type PortalExecutableCommand = Exclude<PortalCommand, PortalViewStartCommand | PortalViewStopCommand>;

export type PortalExtensionCommand = {
    requestId: string;
    type: string;
    payload?: unknown;
};

export type PortalClientCommand = PortalCommand | PortalExtensionCommand;

export type PortalHelloEvent = {
    type: 'hello';
    protocolVersion: typeof PORTAL_PROTOCOL_VERSION;
    capabilities: string[];
    extensions: string[];
};

export type PortalLocationChangedEvent = {
    type: 'location.changed';
    url: string;
};

export type PortalViewFrameMetadata = {
    type: 'view.frame-meta';
    frameId: string;
    format: 'jpeg';
    metadata?: unknown;
};

export type PortalCommandResultEvent = {
    type: 'command.result';
    requestId: string;
    payload?: unknown;
};

export type PortalCommandErrorEvent = {
    type: 'command.error';
    requestId: string;
    code: PortalErrorCode;
    message: string;
};

export type PortalEvent =
    | PortalHelloEvent
    | PortalLocationChangedEvent
    | PortalViewFrameMetadata
    | PortalCommandResultEvent
    | PortalCommandErrorEvent;

export type PortalExtensionEvent = {
    type: string;
    payload?: unknown;
};

export type PortalServerEvent = PortalEvent | PortalExtensionEvent;

export type PortalJsonPacket = {
    kind: 'json';
    value: PortalClientCommand | PortalServerEvent;
};

export type PortalBinaryPacket = {
    kind: 'binary';
    channel: 'view.frame';
    frameId: string;
    payload: Uint8Array;
};

export type PortalPacket = PortalJsonPacket | PortalBinaryPacket;

export type PortalErrorCode =
    | 'NO_ACTIVE_PAGE'
    | 'TARGET_CLOSED'
    | 'UNSUPPORTED_BACKEND'
    | 'INVALID_COMMAND'
    | 'COMMAND_FAILED';

export const CORE_COMMAND_TYPES = [
    'navigate.goto',
    'navigate.reload',
    'navigate.back',
    'navigate.forward',
    'input.click',
    'input.type',
    'input.mouse',
    'input.keyboard',
    'view.start',
    'view.stop',
] as const;

export const isPortalCommandType = (value: string): value is PortalCommand['type'] =>
    (CORE_COMMAND_TYPES as ReadonlyArray<string>).includes(value);

export const isPortalClientCommand = (value: unknown): value is PortalClientCommand =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string' &&
    'requestId' in value &&
    typeof (value as { requestId: unknown }).requestId === 'string';
