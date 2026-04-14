import { defineConfig } from 'vite-plus';

export default defineConfig({
    pack: {
        clean: true,
        dts: true,
        deps: {
            skipNodeModulesBundle: true,
        },
        entry: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
        format: ['esm'],
        unbundle: true,
        outExtensions: () => ({
            js: '.js',
            dts: '.d.ts',
        }),
    },
});
