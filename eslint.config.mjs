import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {files: ["**/*.js"], languageOptions: {sourceType: "commonjs"}},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      project: "./tsconfig.json", // Adjust path if necessary
    },
    extends: [
      "plugin:@typescript-eslint/recommended",
      "plugin:prettier/recommended", // Optional, if using Prettier
    ],
    rules: {
      // Add specific rules as needed
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
    ignorePatterns: [
      "**/node_modules/**",
      "**/*.config.ts",
      "**/dist/",
      "**/.husky/",
      "**/yarn-error.log",
      "**/yarn.lock",
      ".yarn/*",
      "**/lib/",
      "**/webpack.config.js",
    ]
  }
];