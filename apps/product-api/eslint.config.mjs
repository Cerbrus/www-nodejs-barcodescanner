import baseConfig from '../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "MemberExpression[object.name='process'][property.name='env']",
                    message: 'Read settings through AppConfig (src/config/app.config.ts), not from process.env.',
                },
            ],
        },
        ignores: ['src/config/app.config.ts', 'src/test/**', '**/*.spec.ts'],
    },
    {
        files: ['src/core/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/api/**'],
                            message:
                                'core must not import from api: dependencies point inward (api, then core, then data).',
                        },
                    ],
                },
            ],
        },
        ignores: ['**/*.spec.ts'],
    },
    {
        files: ['src/data/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/api/**', '**/core/**'],
                            message:
                                'data must not import from api or core: dependencies point inward (api, then core, then data).',
                        },
                    ],
                },
            ],
        },
        ignores: ['**/*.spec.ts'],
    },
    {
        files: ['src/config/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/api/**', '**/core/**', '**/data/**'],
                            message: 'config must not import from the layers that read it.',
                        },
                    ],
                },
            ],
        },
        ignores: ['**/*.spec.ts'],
    },
    {
        files: ['**/*.spec.ts'],
        rules: {
            'max-lines-per-function': 'off',
        },
    },
    {
        ignores: ['**/*.config.js'],
    },
];
