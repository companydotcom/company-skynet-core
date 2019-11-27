// // webpack.config.js

// var webpack = require('webpack');
// var path = require('path');
// var libraryName = 'library';
// var outputFile = libraryName + '.js';

// var config = {
//   entry: __dirname + '/index.js',
//   devtool: 'source-map',
//   output: {
//     path: __dirname + '/lib',
//     filename: outputFile,
//     library: libraryName,
//     libraryTarget: 'umd',
//     umdNamedDefine: true
//   },
//   module: {
//     loaders: [
//       {
//         test: /(\\.jsx|\\.js)$/,
//         loader: 'babel',
//         exclude: /(node_modules|bower_components)/
//       },
//       {
//         test: /(\\.jsx|\\.js)$/,
//         loader: "eslint-loader",
//         exclude: /node_modules/
//       }
//     ]
//   },
//   resolve: {
//     root: path.resolve('./'),
//     extensions: ['', '.js']
//   }
// };

// module.exports = config;















// const path = require('path');

// module.exports = {
//   entry: './index.js',
//   output: {
//     filename: 'index.js',
//     path: path.resolve(__dirname, 'lib'),
//   },
// };















const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve('dist'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /(node_modules)/,
        use: 'babel-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
};