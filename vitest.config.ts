// // vitest.config.ts
// import { loadEnv } from 'vite';
import { defineConfig, configDefaults } from 'vitest/config';
// import fs from 'fs';
// import * as dotenv from 'dotenv';

// const parseEnvFiles = (configFile: string) => {
//   try {
//     const data = fs.readFileSync(configFile, 'utf8');
//     const data_env = fs.readFileSync(process.cwd() + '.env', 'utf8');
//     const json_env = dotenv.parse(data_env);
//     console.log('Json env is - ', json_env);
//     let json = JSON.parse(data);
//     json = { ...json, ...dotenv.parse(data), ...json_env };
//     console.log('JSON is - ', json);
//     return json;
//   } catch (err) {
//     console.log('Error parsing .env file:', err.toString());
//     return {};
//   }
// };

// let env = parseEnvFiles(process.cwd() + '/' + process.env.CONFIG_FILE);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      'lib/*',
      'lib/**/*',
      'tests/*',
      'tests/**/*',
      'node_modules',
    ],
    // Add more configuration options if needed
  },
});
