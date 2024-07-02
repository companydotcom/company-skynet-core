const path = require("path");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {
  entry: "./src/index.ts",
  // devtool: "inline-source-map",
  mode: "development",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: [/node_modules/, /test/],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      // Ensure these modules are treated as CommonJS modules
      "path": require.resolve("@middy/core/")
      // Add any other modules that need to be treated as CommonJS here
    },
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
