const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = function (env, argv) {
  const prod = argv && argv.mode === 'production';
  return {
    mode: prod ? 'production' : 'development',
    entry: {
      main: {
        import: './src/index.tsx',
      },
      import: {
        import: './src/import.js',
        filename: 'import.js',
      },
      lodestone: {
        import: './src/lodestone.js',
      },
      serviceworker: {
        import: './src/serviceworker.js',
        filename: 'serviceworker.js',
      },
    },
    output: {
      filename: prod ? '[name].[contenthash].js' : '[name].bundle.js',
      chunkFilename: prod ? '[name].[contenthash].js' : '[name].bundle.js',
      hashDigestLength: 10,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'simple-functional-loader',
              ident: 'keep-react-component-display-name',
              options: {
                processor: source => source.replace(
                  /([\r\n](?:export )?)const (.+?) = (.+?)\(\((.*?)\) => {([\r\n])/g,
                  '$1const $2 = $3(function $2($4) {$5',
                ),
              },
            },
            prod && {
              loader: 'simple-functional-loader',
              ident: 'remove-console-debug',
              options: {
                processor: source => source.replace(/([\r\n])\s*console\.debug\(.+?\);/g, '$1'),
              },
            },
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                compilerOptions: {
                  jsx: prod ? 'react-jsx' : 'react-jsxdev',
                },
              },
            },
          ].filter(Boolean),
        },
        {
          test: /node_modules[\\\/]@material[\\\/]ripple[\\\/]foundation\.js$/,
          use: {
            loader: 'simple-functional-loader',
            ident: 'mdc-ripple-fix',
            options: {
              // mdc-ripple should not force using even number ripple size.
              processor: source => source.replace('initialSize - 1;', 'initialSize;'),
            },
          },
        },
        {
          test: /\.s?css$/,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    ['postcss-preset-env', { features: { 'case-insensitive-attributes': false } }],
                    prod && 'cssnano',
                  ].filter(Boolean),
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  includePaths: ['./node_modules'],
                },
              },
            },
          ],
        },
        { test: /\.svg$/, use: 'svg-sprite-loader' },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        favicon: './img/favicon.ico',
        chunks: ['main'],
      }),
      new HtmlWebpackPlugin({
        filename: 'lodestone.html',
        title: 'Redirecting...',
        chunks: ['lodestone'],
      }),
      new ForkTsCheckerWebpackPlugin({
        async: !prod,
        logger: {
          issues: 'webpack-infrastructure',
        },
      }),
    ],
    optimization: {
      concatenateModules: prod && !argv.analyze,
      splitChunks: {
        chunks: 'initial',
        cacheGroups: {
          defaultVendors: false,
          default: false,
          essentialVendors: {
            test: module => [
              new RegExp(`[\\\\/]node_modules[\\\\/](${[
                'react', 'react-dom', 'scheduler', 'object-assign',
                'mobx', 'mobx-state-tree', 'mobx-react-lite',
                'classnames', 'style-loader', 'css-loader',
                '@popperjs', 'react-popper', 'react-fast-compare',
              ].join('|')})[\\\\/]`),
              /[\\/]sanitize\.scss$/,
            ].some(r => r.test(module.resource)),
            name: 'vendor-essential',
            priority: 1,
          },
          restVendors: {
            test: module => [
              /[\\/]node_modules[\\/]/,
              /[\\/]img[\\/]/,
              /[\\/]material\.scss$/,
              /[\\/]BigInteger\.js$/,
            ].some(r => r.test(module.resource)),
            name: 'vendor-rest',
          },
          data: {
            test: /[\\/]data[\\/]out[\\/](?!lodestoneIds\.js$).+/,
            name: 'data',
          },
        },
      },
    },
    performance: {
      hints: false,
    },
    stats: {
      preset: 'errors-warnings',
      builtAt: true,
      timings: true,
    },
    devtool: !prod && 'cheap-source-map',
    devServer: {
      hot: false,
      liveReload: false,
      injectClient: false,
      injectHot: false,
      static: false,
    },
  };
};
