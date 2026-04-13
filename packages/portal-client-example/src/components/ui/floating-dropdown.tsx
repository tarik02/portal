import { cloneElement, type ReactElement, type ReactNode } from 'react';
import {
    FloatingPortal,
    FloatingNode,
    useFloatingNodeId,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useFocus,
    useHover,
    useInteractions,
    safePolygon,
    type Placement,
} from '@floating-ui/react';

type FloatingDropdownProps = {
    children: ReactElement;
    floatingClassName?: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    panel: ReactNode;
    placement?: Placement;
    testId?: string;
    interaction?: 'click' | 'hover';
    dismissOnOutsidePress?: boolean;
};

export const FloatingDropdown = ({
    children,
    floatingClassName,
    interaction = 'click',
    isOpen,
    onOpenChange,
    panel,
    placement = 'bottom-end',
    dismissOnOutsidePress = true,
    testId,
}: FloatingDropdownProps) => {
    const nodeId = useFloatingNodeId();
    const { context, floatingStyles, refs } = useFloating({
        nodeId,
        middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
        open: isOpen,
        onOpenChange,
        placement,
        whileElementsMounted: autoUpdate,
    });

    const hover = useHover(context, {
        enabled: interaction === 'hover',
        handleClose: safePolygon(),
        move: false,
    });
    const click = useClick(context, {
        enabled: interaction === 'click',
        toggle: true,
    });
    const focus = useFocus(context, {
        enabled: interaction === 'hover',
    });
    const dismiss = useDismiss(context, {
        outsidePress: dismissOnOutsidePress,
        bubbles: {
            outsidePress: false,
        },
    });
    const { getFloatingProps, getReferenceProps } = useInteractions([hover, click, focus, dismiss]);

    return (
        <>
            {cloneElement(
                children as ReactElement<any>,
                {
                    ref: refs.setReference as unknown as React.RefCallback<unknown>,
                    'data-testid': testId,
                    'aria-expanded': isOpen,
                    role: 'button',
                    tabIndex: 0,
                    ...getReferenceProps(children.props as any),
                } as any,
            )}
            <FloatingNode id={nodeId}>
                {isOpen ? (
                    <FloatingPortal>
                        <div
                            ref={refs.setFloating}
                            className={floatingClassName}
                            style={floatingStyles}
                            {...getFloatingProps()}
                        >
                            {panel}
                        </div>
                    </FloatingPortal>
                ) : null}
            </FloatingNode>
        </>
    );
};
