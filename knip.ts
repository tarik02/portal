import type { KnipConfig } from 'knip';

const config = {
    workspaces: {
        '.': {
            entry: ['vite.config.ts', 'scripts/setup-publish-package.ts'],
            ignoreDependencies: ['jsdom'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-core': {
            entry: ['src/**/*.test.ts'],
            project: ['src/**/*.{ts,tsx}', '!src/index.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-server': {
            entry: ['src/**/*.test.ts'],
            project: ['src/**/*.{ts,tsx}', '!src/index.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-playwright-example': {
            entry: ['src/**/*.test.ts'],
            project: ['src/**/*.ts', '!src/main.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-puppeteer-example': {
            entry: ['src/**/*.test.ts'],
            project: ['src/**/*.ts', '!src/main.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-client': {
            entry: ['src/**/*.test.ts'],
            project: ['src/**/*.{ts,tsx}', '!src/index.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-client-example': {
            entry: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            project: ['src/**/*.{ts,tsx}', '!src/main.tsx', '!vite.config.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
        'packages/portal-example-common': {
            entry: ['src/**/*.test.ts'],
            project: ['src/**/*.{ts,tsx}', '!src/index.ts'],
            typescript: {
                config: ['tsconfig.json'],
            },
        },
    },
} satisfies KnipConfig;

export default config;
