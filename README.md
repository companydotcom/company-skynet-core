# company-skynet-core
Company Skynet Core library
This GIT repo is only for comsumption and edit for members belonging to company.com
Use the Company Skynet Generator repo instead for actual usage.

For company.com developers:
Do 'npm install' and then 'npm run build' to create the distribution file
index.js under dist folder.
To publish:
1. increment the version in package.json,
2. Build the package using 'npm run build',
3. do 'npm login',
4. do 'npm config set scope companydotcom',
5. do 'npm publish --access public'
