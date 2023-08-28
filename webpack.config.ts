const path = require("path");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {
  entry: "./src/index.ts",
  devtool: "inline-source-map",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: [/node_modules/, /test/],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  target: 'node',
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "umd",
    globalObject: "this",
  },
  plugins: [
    new NodePolyfillPlugin()
  ],
};
