/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PORTAL_BASE_URL?: string;
    readonly VITE_PORTAL_HIDE_PORTAL_INPUT?: string;
    readonly VITE_PORTAL_TOKEN?: string;
    readonly VITE_PORTAL_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface Window {
    readonly __PORTAL_CLIENT_EXAMPLE_CONFIG__?: {
        hidePortalInput?: boolean;
        portalUrl?: string;
    };
}
