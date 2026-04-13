import {
    createPortalBrowserViewImageDataUrl,
    createPortalBrowserViewKeyboardCommand,
    createPortalBrowserViewMouseCommand,
    createPortalBrowserViewTypeCommand,
    getPortalBrowserViewSize,
    type PortalClientFrame,
} from '@tarik02/portal-client';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type KeyboardEvent,
    type MouseEvent,
    type RefObject,
    type WheelEvent,
} from 'react';

import { Card, CardContent } from './components/ui/card';
import type { PortalConnectionState } from './model';

const FALLBACK_ASPECT_RATIO = '16 / 10';
const FALLBACK_ASPECT_RATIO_VALUE = 16 / 10;
type PortalBrowserViewMouseCommand = NonNullable<ReturnType<typeof createPortalBrowserViewMouseCommand>>;
type PortalBrowserViewKeyboardCommand = NonNullable<ReturnType<typeof createPortalBrowserViewKeyboardCommand>>;
type PortalBrowserViewTypeCommand = ReturnType<typeof createPortalBrowserViewTypeCommand>;

export const resolveBrowserViewShellWidth = ({
    aspectRatio,
    viewportHeight,
    viewportWidth,
}: {
    aspectRatio: number;
    viewportHeight: number;
    viewportWidth: number;
}) => {
    if (viewportWidth <= 0 || viewportHeight <= 0 || aspectRatio <= 0) {
        return;
    }

    return Math.min(viewportWidth, viewportHeight * aspectRatio);
};

const useElementSize = <T extends HTMLElement>(ref: RefObject<T | null>) => {
    const [size, setSize] = useState({ height: 0, width: 0 });

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setSize((current) =>
                current.width === rect.width && current.height === rect.height
                    ? current
                    : {
                          height: rect.height,
                          width: rect.width,
                      },
            );
        };

        updateSize();

        const ResizeObserverImpl = globalThis.ResizeObserver;
        if (!ResizeObserverImpl) {
            return;
        }

        const observer = new ResizeObserverImpl(() => {
            updateSize();
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [ref]);

    return size;
};

const getPlaceholderText = ({
    connectionState,
    emptyText,
    statusText,
}: {
    connectionState: PortalConnectionState;
    emptyText?: string;
    statusText?: string;
}) => {
    if (statusText) {
        return statusText;
    }

    if (connectionState === 'connecting') {
        return 'Connecting to portal session...';
    }

    if (connectionState === 'closed') {
        return 'Connect to a worker to start the browser view.';
    }

    return emptyText ?? 'The session is live. Start the view stream to receive frames.';
};

export const BrowserView = ({
    className,
    connectionState,
    emptyText,
    frame,
    sendKeyboardCommand,
    sendMouseCommand,
    sendTypeCommand,
    statusText,
}: {
    className?: string;
    connectionState: PortalConnectionState;
    emptyText?: string;
    frame: PortalClientFrame | null;
    sendKeyboardCommand?: (command: PortalBrowserViewKeyboardCommand) => Promise<void> | void;
    sendMouseCommand?: (command: PortalBrowserViewMouseCommand) => Promise<void> | void;
    sendTypeCommand?: (command: PortalBrowserViewTypeCommand) => Promise<void> | void;
    statusText?: string;
}) => {
    const shellRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const frameSize = frame ? getPortalBrowserViewSize(frame.metadata) : undefined;
    const imageSrc = frame ? createPortalBrowserViewImageDataUrl(frame) : null;
    const aspectRatioValue = frameSize ? frameSize.width / frameSize.height : FALLBACK_ASPECT_RATIO_VALUE;
    const aspectRatio = frameSize ? `${frameSize.width} / ${frameSize.height}` : FALLBACK_ASPECT_RATIO;
    const viewportSize = useElementSize(viewportRef);
    const shellWidth = resolveBrowserViewShellWidth({
        aspectRatio: aspectRatioValue,
        viewportHeight: viewportSize.height,
        viewportWidth: viewportSize.width,
    });

    useHotkey(
        'Mod+V',
        async () => {
            if (!sendTypeCommand || !frame) {
                return;
            }

            try {
                const text = await navigator.clipboard.readText();
                if (text === '') {
                    return;
                }

                await sendTypeCommand(createPortalBrowserViewTypeCommand(text));
            } catch {
                // Ignore clipboard permission failures and keep the browser shell responsive.
            }
        },
        {
            enabled: Boolean(frame && sendTypeCommand),
            preventDefault: true,
            target: shellRef,
        },
    );

    const dispatchMouseCommand = async (event: MouseEvent<HTMLDivElement> | WheelEvent<HTMLDivElement>) => {
        if (!frame || !sendMouseCommand) {
            return;
        }

        const command = createPortalBrowserViewMouseCommand({
            bounds: event.currentTarget.getBoundingClientRect(),
            event: event.nativeEvent,
            metadata: frame.metadata,
        });

        if (!command) {
            return;
        }

        await sendMouseCommand(command);
    };

    const dispatchKeyboardCommand = async (event: KeyboardEvent<HTMLDivElement>) => {
        if (!frame || !sendKeyboardCommand) {
            return;
        }

        const command = createPortalBrowserViewKeyboardCommand(event.nativeEvent);
        if (!command) {
            return;
        }

        event.preventDefault();
        await sendKeyboardCommand(command);
    };

    const dispatchPaste = async (event: ClipboardEvent<HTMLDivElement>) => {
        if (!frame || !sendTypeCommand) {
            return;
        }

        const text = event.clipboardData.getData('text/plain');
        if (text === '') {
            return;
        }

        event.preventDefault();
        await sendTypeCommand(createPortalBrowserViewTypeCommand(text));
    };

    return (
        <Card className={`col-span-12 h-full min-h-0 overflow-hidden p-0 ${className ?? ''}`.trim()}>
            <CardContent className="h-full min-h-0 p-0">
                <section className="flex h-full min-h-0 flex-col">
                    <div ref={viewportRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                        <div
                            ref={shellRef}
                            className="relative overflow-hidden rounded-sm border-y bg-black/90 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/60 md:rounded-t-sm md:border-x"
                            data-testid="browser-view-shell"
                            onKeyDown={(event) => {
                                if (event.defaultPrevented) {
                                    return;
                                }

                                void dispatchKeyboardCommand(event);
                            }}
                            onKeyUp={(event) => {
                                void dispatchKeyboardCommand(event);
                            }}
                            onMouseDown={(event) => {
                                event.currentTarget.focus();
                                void dispatchMouseCommand(event);
                            }}
                            onMouseMove={(event) => {
                                void dispatchMouseCommand(event);
                            }}
                            onMouseUp={(event) => {
                                void dispatchMouseCommand(event);
                            }}
                            onPaste={(event) => {
                                void dispatchPaste(event);
                            }}
                            onWheel={(event) => {
                                void dispatchMouseCommand(event);
                            }}
                            tabIndex={0}
                            style={{
                                aspectRatio,
                                width: shellWidth,
                            }}
                        >
                            {imageSrc ? (
                                <img
                                    alt="Live browser frame"
                                    className="block h-full w-full object-contain"
                                    height={frameSize?.height}
                                    src={imageSrc}
                                    width={frameSize?.width}
                                />
                            ) : (
                                <div className="grid h-full place-items-center p-4 text-center">
                                    <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
                                        {getPlaceholderText({ connectionState, emptyText, statusText })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </CardContent>
        </Card>
    );
};
