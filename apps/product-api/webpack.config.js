const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');

module.exports = {
    plugins: [
        new NxAppWebpackPlugin({
            target: 'node',
            compiler: 'tsc',
            outputPath: '../../dist/apps/product',
            main: './src/main.ts',
            tsConfig: './tsconfig.app.json',
            generatePackageJson: true,
            outputHashing: 'none'
        })
    ]
};
