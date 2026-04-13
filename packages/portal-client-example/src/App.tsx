import { ArrowLeft, ArrowRight, Pin, PinOff, RefreshCw, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FloatingTree } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { BrowserView } from './BrowserView';
import { readPortalConnectionConfig } from './connection-config';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { FloatingDropdown } from './components/ui/floating-dropdown';
import { getRecentEventTypeOptions, getVisibleRecentEvents, type PortalRecentEvent } from './model';
import { usePortalSession, type PortalSessionHook, type UsePortalSessionResult } from './use-portal-session';

const formatList = (value: string[]) => (value.length > 0 ? value.join(', ') : 'waiting for hello');

const normalizeNavigationUrl = (value: string, origin: string) => {
    const trimmed = value.trim();

    if (trimmed === '') {
        return '';
    }

    if (trimmed.startsWith('/')) {
        return new URL(trimmed, origin).toString();
    }

    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
        return trimmed;
    }

    return `https://${trimmed}`;
};

const formatFrameSize = (frame: UsePortalSessionResult['frame']) => {
    if (!frame) {
        return null;
    }

    const width =
        frame.metadata && typeof frame.metadata === 'object' && 'deviceWidth' in frame.metadata
            ? frame.metadata.deviceWidth
            : null;
    const height =
        frame.metadata && typeof frame.metadata === 'object' && 'deviceHeight' in frame.metadata
            ? frame.metadata.deviceHeight
            : null;

    if (typeof width !== 'number' || typeof height !== 'number') {
        return null;
    }

    return `${width}x${height}`;
};

const statusVariantByConnectionState = {
    closed: 'outline',
    connecting: 'secondary',
    open: 'default',
} as const;

const FilterTypesDropdown = ({
    hiddenEventTypes,
    onHiddenEventTypeToggle,
    recentEvents,
}: {
    hiddenEventTypes: ReadonlySet<string>;
    onHiddenEventTypeToggle: (eventType: string) => void;
    recentEvents: UsePortalSessionResult['recentEvents'];
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const eventTypeOptions = getRecentEventTypeOptions(recentEvents);

    return (
        <FloatingDropdown
            floatingClassName="z-[10000] w-80 max-w-[calc(100vw-2rem)] rounded-sm border bg-card p-2 shadow-lg shadow-black/10"
            interaction="click"
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            panel={
                <div className="max-h-40 overflow-y-auto pr-1">
                    <div className="grid gap-1">
                        {eventTypeOptions.map((eventType) => {
                            const isHidden = hiddenEventTypes.has(eventType);

                            return (
                                <label
                                    key={eventType}
                                    className="flex cursor-pointer items-start gap-2 rounded-sm border bg-muted/20 px-2 py-1 text-xs transition-colors hover:bg-muted/40"
                                >
                                    <input
                                        checked={!isHidden}
                                        className="mt-0.5 size-3.5 rounded border-border text-primary accent-primary"
                                        onChange={() => {
                                            onHiddenEventTypeToggle(eventType);
                                        }}
                                        type="checkbox"
                                    />
                                    <span className="min-w-0 break-all font-mono text-[11px] leading-4 text-foreground">
                                        {eventType}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            }
        >
            <Button
                aria-label="filter types"
                className="h-7 w-full justify-between gap-2 px-2.5 text-xs"
                variant="secondary"
            >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span aria-hidden="true">filter types</span>
                    <span aria-hidden="true" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {hiddenEventTypes.size > 0 ? `${hiddenEventTypes.size} hidden` : 'showing all'}
                    </span>
                </span>
            </Button>
        </FloatingDropdown>
    );
};

const ToolbarStatusPanel = ({
    activeNotice,
    portalUrl,
    session,
}: {
    activeNotice: string | null;
    portalUrl: string;
    session: UsePortalSessionResult;
}) => {
    const pageStateLabel = (() => {
        if (!session.pageState) {
            return 'unknown';
        }

        return session.pageState.hasPage ? 'page available' : 'no page';
    })();

    return (
        <div className="grid gap-2.5 p-3">
            <div className="grid gap-2">
                <div className="text-sm font-semibold leading-none">status</div>
                <dl className="grid gap-2.5 text-sm">
                    <div className="grid gap-1">
                        <dt className="text-xs text-muted-foreground">portal url</dt>
                        <dd className="break-all">{portalUrl || 'unset'}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="text-xs text-muted-foreground">location</dt>
                        <dd className="break-all">{session.location ?? 'not navigated yet'}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="text-xs text-muted-foreground">page state</dt>
                        <dd>{pageStateLabel}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="text-xs text-muted-foreground">protocol</dt>
                        <dd>{session.hello ? `v${session.hello.protocolVersion}` : 'waiting for hello'}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="text-xs text-muted-foreground">capabilities</dt>
                        <dd className="break-words">{formatList(session.hello?.capabilities ?? [])}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="text-xs text-muted-foreground">extensions</dt>
                        <dd className="break-words">{formatList(session.hello?.extensions ?? [])}</dd>
                    </div>
                </dl>
            </div>

            {session.latestError ? (
                <div className="rounded-sm border border-destructive/40 bg-destructive/8 p-2.5 text-sm">
                    <div className="font-medium text-destructive">{session.latestError.code}</div>
                    <p className="mt-0.5 text-muted-foreground">{session.latestError.message}</p>
                </div>
            ) : null}

            {activeNotice ? (
                <div className="rounded-sm border border-border bg-muted/40 p-2.5 text-sm">
                    <div className="font-medium">connection</div>
                    <p className="mt-0.5 text-muted-foreground">{activeNotice}</p>
                </div>
            ) : null}
        </div>
    );
};

const ToolbarEventsPanel = ({
    events,
    alwaysShown,
    hiddenEventTypes,
    onClose,
    onAlwaysShownChange,
    onPauseChange,
    onHiddenEventTypeToggle,
    paused,
    recentEvents,
}: {
    events: UsePortalSessionResult['recentEvents'];
    alwaysShown: boolean;
    hiddenEventTypes: ReadonlySet<string>;
    onClose: () => void;
    onAlwaysShownChange: (alwaysShown: boolean) => void;
    onHiddenEventTypeToggle: (eventType: string) => void;
    onPauseChange: (paused: boolean) => void;
    paused: boolean;
    recentEvents: UsePortalSessionResult['recentEvents'];
}) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const previousEventsRef = useRef(events);
    const previousTotalSizeRef = useRef(0);
    const estimatedRowHeight = 72;
    const rowVirtualizer = useVirtualizer({
        count: events.length,
        estimateSize: () => estimatedRowHeight,
        getScrollElement: () => scrollRef.current,
        getItemKey: (index) => events[index]?.id ?? index,
        initialRect: {
            height: 400,
            width: 800,
        },
        overscan: 4,
        useFlushSync: false,
        observeElementRect: (instance, cb) => {
            const element = instance.scrollElement;

            if (!element) {
                return;
            }

            cb(element.getBoundingClientRect());
        },
    });

    useLayoutEffect(() => {
        const scrollElement = scrollRef.current;
        const previousEvents = previousEventsRef.current;
        const nextTotalSize = rowVirtualizer.getTotalSize();

        const isPrependedUpdate =
            previousEvents.length > 0 &&
            events.length > previousEvents.length &&
            previousEvents.every(
                (event, index) => events[events.length - previousEvents.length + index]?.id === event.id,
            );

        if (isPrependedUpdate && scrollElement && scrollElement.scrollTop > 0) {
            const estimatedDelta = (events.length - previousEvents.length) * estimatedRowHeight;
            const delta =
                nextTotalSize > previousTotalSizeRef.current
                    ? nextTotalSize - previousTotalSizeRef.current
                    : estimatedDelta;

            if (delta > 0) {
                scrollElement.scrollTop += delta;
            }
        }

        previousEventsRef.current = events;
        previousTotalSizeRef.current = nextTotalSize;
    }, [events, rowVirtualizer]);

    return (
        <div className="flex max-h-[min(400px,50vh)] min-w-0 flex-col gap-2.5 overflow-hidden p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold leading-none">recent events</div>
                <div className="flex items-center gap-1.5">
                    <label className="flex cursor-pointer items-center gap-2 rounded-sm border bg-muted/20 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40">
                        <input
                            checked={paused}
                            className="size-3.5 rounded border-border text-primary accent-primary"
                            onChange={(event) => {
                                onPauseChange(event.target.checked);
                            }}
                            type="checkbox"
                        />
                        <span>pause updates</span>
                    </label>
                    <Badge variant="secondary">{events.length}</Badge>
                    <Button
                        aria-label={alwaysShown ? 'unpin events' : 'pin events'}
                        aria-pressed={alwaysShown}
                        className="size-7 rounded-sm"
                        onClick={() => {
                            onAlwaysShownChange(!alwaysShown);
                        }}
                        size="icon"
                        variant="ghost"
                    >
                        {alwaysShown ? <Pin className="size-4" /> : <PinOff className="size-4" />}
                    </Button>
                    <Button
                        aria-label="close events"
                        className="size-7 rounded-sm"
                        onClick={onClose}
                        size="icon"
                        variant="ghost"
                    >
                        <X />
                    </Button>
                </div>
            </div>

            <div className="grid gap-1.5">
                <FilterTypesDropdown
                    hiddenEventTypes={hiddenEventTypes}
                    onHiddenEventTypeToggle={onHiddenEventTypeToggle}
                    recentEvents={recentEvents}
                />
            </div>

            <div
                ref={scrollRef}
                data-testid="events-scroll"
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"
            >
                {events.length > 0 ? (
                    <ol
                        className="relative min-w-0"
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const event = events[virtualRow.index];

                            if (!event) {
                                return null;
                            }

                            const eventDirection = event.direction ?? 'received';

                            return (
                                <li
                                    key={virtualRow.key}
                                    className="absolute left-0 top-0 min-w-0 w-full"
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    style={{
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className="min-w-0 rounded-sm border bg-muted/30 p-2.5 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="min-w-0 break-all text-primary">{event.type}</code>
                                            <Badge
                                                className="h-5 px-1.5 text-[10px] uppercase tracking-wide"
                                                variant={eventDirection === 'sent' ? 'secondary' : 'outline'}
                                            >
                                                {eventDirection}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 break-words text-muted-foreground">{event.summary}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <p className="text-sm text-muted-foreground">No events received yet.</p>
                )}
            </div>
        </div>
    );
};

export const App = ({ useSession = usePortalSession }: { useSession?: PortalSessionHook }) => {
    const session = useSession();
    const [connectionConfig] = useState(readPortalConnectionConfig);
    const [portalUrl, setPortalUrl] = useState(connectionConfig.portalUrl);
    const [eventsPaused, setEventsPaused] = useState(false);
    const [eventsAlwaysShown, setEventsAlwaysShown] = useState(false);
    const [hiddenEventTypes, setHiddenEventTypes] = useState<Set<string>>(() => new Set());
    const [pausedEventsSnapshot, setPausedEventsSnapshot] = useState<PortalRecentEvent[] | null>(null);
    const [pageUrl, setPageUrl] = useState('');
    const [statusOpen, setStatusOpen] = useState(false);
    const [eventsOpen, setEventsOpen] = useState(false);
    const didAutoConnect = useRef(false);

    useEffect(() => {
        if (!session.location) {
            return;
        }

        setPageUrl(session.location);
    }, [session.location]);

    useEffect(() => {
        if (session.connectionState === 'open') {
            return;
        }

        setEventsPaused(false);
        setPausedEventsSnapshot(null);
    }, [session.connectionState]);

    useEffect(() => {
        if (didAutoConnect.current) {
            return;
        }

        if (!connectionConfig.hidePortalInput || connectionConfig.portalUrl.trim() === '') {
            return;
        }

        didAutoConnect.current = true;
        void session.connect(connectionConfig.portalUrl);
    }, [connectionConfig.hidePortalInput, connectionConfig.portalUrl, session]);

    const isConnected = session.connectionState === 'open';
    const commandDisabled = !isConnected;
    const activeNotice = session.connectionIssue;
    const lastEventName = session.recentEvents.at(-1)?.type ?? 'none';
    const visibleEvents = getVisibleRecentEvents(session.recentEvents, hiddenEventTypes);
    const displayedEvents = eventsPaused ? (pausedEventsSnapshot ?? visibleEvents) : visibleEvents;
    const reversedDisplayedEvents = [...displayedEvents].toReversed();

    return (
        <FloatingTree>
            <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_42%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.6))] text-foreground">
                <main className="mx-auto grid h-full max-w-7xl grid-cols-12 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 px-3 py-3 md:px-4 md:py-4">
                    <div className="col-span-12 flex items-center gap-1.5 rounded-sm border bg-card/70 p-1 shadow-sm backdrop-blur">
                        {connectionConfig.hidePortalInput ? (
                            <div className="flex min-w-0 flex-1 items-center px-2 py-1 text-sm text-muted-foreground">
                                embedded portal session
                            </div>
                        ) : (
                            <form
                                className="flex min-w-0 flex-1 items-center gap-1.5"
                                onSubmit={(event) => {
                                    event.preventDefault();

                                    if (portalUrl.trim() === '') {
                                        return;
                                    }

                                    void session.connect(portalUrl);
                                }}
                            >
                                <Input
                                    aria-label="Portal URL"
                                    className="h-8 rounded-sm bg-background/80 text-sm"
                                    onChange={(event) => setPortalUrl(event.target.value)}
                                    placeholder="ws://localhost:8005/portal?token=..."
                                    value={portalUrl}
                                />
                                <Button
                                    className="h-7 px-2.5 text-xs"
                                    disabled={portalUrl.trim() === ''}
                                    size="sm"
                                    type="submit"
                                >
                                    connect
                                </Button>
                            </form>
                        )}
                        <div className="flex items-center gap-1.5">
                            <Badge
                                className="w-24 shrink-0 justify-center cursor-default select-none"
                                variant="secondary"
                            >
                                <span className="font-mono text-[10px] uppercase tracking-wide">
                                    {formatFrameSize(session.frame) ?? 'no frame'}
                                </span>
                            </Badge>
                            <FloatingDropdown
                                floatingClassName="z-[9999] min-w-80 max-w-[24rem] rounded-sm border bg-card p-0 shadow-lg shadow-black/10"
                                interaction="hover"
                                testId="status-toolbar-trigger"
                                isOpen={statusOpen}
                                onOpenChange={setStatusOpen}
                                panel={
                                    <ToolbarStatusPanel
                                        activeNotice={activeNotice}
                                        portalUrl={portalUrl}
                                        session={session}
                                    />
                                }
                            >
                                <Badge
                                    className="w-24 shrink-0 justify-center cursor-default select-none"
                                    variant={statusVariantByConnectionState[session.connectionState]}
                                >
                                    {session.connectionState}
                                </Badge>
                            </FloatingDropdown>
                            <FloatingDropdown
                                floatingClassName="z-[9999] min-w-80 max-w-[24rem] rounded-sm border bg-card p-0 shadow-lg shadow-black/10"
                                dismissOnOutsidePress={false}
                                interaction="hover"
                                testId="events-toolbar-trigger"
                                isOpen={eventsOpen}
                                onOpenChange={(open) => {
                                    if (!open && eventsAlwaysShown) {
                                        return;
                                    }

                                    setEventsOpen(open);
                                }}
                                panel={
                                    <ToolbarEventsPanel
                                        events={reversedDisplayedEvents}
                                        alwaysShown={eventsAlwaysShown}
                                        hiddenEventTypes={hiddenEventTypes}
                                        onClose={() => {
                                            setEventsAlwaysShown(false);
                                            setEventsOpen(false);
                                        }}
                                        onAlwaysShownChange={setEventsAlwaysShown}
                                        onHiddenEventTypeToggle={(eventType) => {
                                            setHiddenEventTypes((current) => {
                                                const next = new Set(current);

                                                if (next.has(eventType)) {
                                                    next.delete(eventType);
                                                } else {
                                                    next.add(eventType);
                                                }

                                                return next;
                                            });
                                        }}
                                        onPauseChange={(nextPaused) => {
                                            setEventsPaused(nextPaused);
                                            setPausedEventsSnapshot(nextPaused ? visibleEvents : null);
                                        }}
                                        paused={eventsPaused}
                                        recentEvents={session.recentEvents}
                                    />
                                }
                            >
                                <Badge
                                    className="w-28 shrink-0 justify-between gap-2 cursor-default select-none"
                                    variant="secondary"
                                >
                                    <span>events</span>
                                    <span className="w-[10ch] truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {lastEventName}
                                    </span>
                                </Badge>
                            </FloatingDropdown>
                        </div>
                    </div>

                    <div className="col-span-12 flex items-center gap-1.5 rounded-sm border bg-card/70 p-1 shadow-sm backdrop-blur">
                        <div className="flex items-center gap-1">
                            <Button
                                aria-label="Back"
                                className="size-8 rounded-sm"
                                disabled={commandDisabled}
                                onClick={() => {
                                    void session.goBack();
                                }}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <ArrowLeft />
                            </Button>
                            <Button
                                aria-label="Forward"
                                className="size-8 rounded-sm"
                                disabled={commandDisabled}
                                onClick={() => {
                                    void session.goForward();
                                }}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <ArrowRight />
                            </Button>
                            <Button
                                aria-label="Reload"
                                className="size-8 rounded-sm"
                                disabled={commandDisabled}
                                onClick={() => {
                                    void session.reload();
                                }}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <RefreshCw />
                            </Button>
                        </div>

                        <form
                            className="flex min-w-0 flex-1 items-center gap-1.5"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (pageUrl.trim() === '') {
                                    return;
                                }

                                void session.goto(normalizeNavigationUrl(pageUrl, globalThis.location.origin));
                            }}
                        >
                            <Input
                                aria-label="Address"
                                className="h-8 rounded-sm bg-background/80 text-sm"
                                onChange={(event) => setPageUrl(event.target.value)}
                                placeholder="https://example.com/"
                                value={pageUrl}
                            />
                        </form>
                    </div>

                    <BrowserView
                        className="min-h-0"
                        connectionState={session.connectionState}
                        frame={session.frame}
                        sendKeyboardCommand={session.keyboard}
                        sendMouseCommand={session.mouse}
                        sendTypeCommand={async (command) => {
                            await session.type(command.text);
                        }}
                        statusText={activeNotice ?? undefined}
                    />
                </main>
            </div>
        </FloatingTree>
    );
};
