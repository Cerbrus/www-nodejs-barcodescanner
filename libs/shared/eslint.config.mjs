import baseConfig from '../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@angular/*', '@nestjs/*', 'typeorm', '**/apps/**'],
                            message: 'The shared library is plain TypeScript: no Angular, NestJS, TypeORM or app code.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['**/*.spec.ts'],
        rules: {
            'max-lines-per-function': 'off'
        }
    }
];
