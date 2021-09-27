# company-skynet-core

Company Skynet Core library
This GIT repo is only editable for members belonging to the company.com development organization.
Use the Company Skynet Generator repo, to generate your micro application for the Company.com platform.

# Publishing

For company.com developers:

To create the 'index.js' distribution file, in your CLI, type: `yarn install` and then `yar n run build` to create the distribution file

To publish:

1. Increment the version in package.json,
2. Build the package using `yarn run build`,
3. In your CLI: `npm login`,
4. In your CLI: `npm config set scope companydotcom`,
5. In your CLI: `npm publish --access public`
