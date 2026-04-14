import { defineConfig } from 'vite-plus';

export default defineConfig({
    lint: {
        categories: {
            correctness: 'error',
            suspicious: 'error',
            pedantic: 'warn',
            perf: 'warn',
            style: 'warn',
        },
        ignorePatterns: ['node_modules'],
        options: {
            typeAware: true,
        },
        plugins: ['unicorn'],
        rules: {
            'arrow-body-style': 'off',
            'capitalized-comments': 'off',
            'filename-case': 'off',
            'func-style': 'off',
            'id-length': 'off',
            'init-declarations': 'off',
            'max-classes-per-file': 'off',
            'max-depth': 'off',
            'max-lines': 'off',
            'max-lines-per-function': 'off',
            'max-params': 'off',
            'max-statements': 'off',
            'no-await-in-loop': 'off',
            'no-continue': 'off',
            'no-loop-func': 'off',
            'no-magic-numbers': 'off',
            'no-negated-condition': 'off',
            'no-null': 'off',
            'no-ternary': 'off',
            'prefer-destructuring': 'off',
            'prefer-ternary': 'off',
            'sort-imports': 'off',
            'sort-keys': 'off',
            'no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'after-used',
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'no-thenable': 'off',
        },
    },
    fmt: {
        printWidth: 120,
        singleQuote: true,
        tabWidth: 4,
        trailingComma: 'all',
        sortPackageJson: false,
        ignorePatterns: [],
        overrides: [
            {
                files: ['*.js', '*.jsx', '*.ts', '*.tsx', '*.mts', '*.cts'],
                options: {
                    importOrder: ['<THIRD_PARTY_MODULES>', String.raw`^\.\./`, String.raw`^\./`],
                    importOrderSeparation: true,
                    importOrderSortSpecifiers: true,
                },
            },
            {
                files: ['*.json', '*.jsonc', '*.yml', '*.yaml'],
                options: {
                    tabWidth: 2,
                },
            },
        ],
    },
});
