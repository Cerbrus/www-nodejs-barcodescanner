import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

import baseConfig from '../../eslint.config.mjs';

export default tseslint.config(
    ...baseConfig,
    {
        files: ['**/*.ts'],
        extends: [...angular.configs.tsRecommended],
        processor: angular.processInlineTemplates,
        rules: {
            '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
            '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }]
        }
    },
    {
        files: ['**/*.html'],
        extends: [...angular.configs.templateRecommended]
    },
    {
        files: ['**/*.spec.ts'],
        rules: {
            'max-lines-per-function': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off'
        }
    },
    {
        ignores: ['**/*.config.js', 'src/sw.js']
    }
);
