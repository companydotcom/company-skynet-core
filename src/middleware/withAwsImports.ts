import middy from '@middy/core';
import { parse } from '@babel/parser';
// import traverse from '@babel/traverse';
import { Identifier } from '@babel/types';

const withAwsImports = (
  awsImports: any,
  workerFile: string,
): middy.MiddlewareObj => {
  // console.log('workerFile - ', workerFile);
  const middlewareName = 'withAwsImports';
  const before: middy.MiddlewareFn = async (request): Promise<void> => {
    // console.log('Running withAwsImports middleware - BEFORE');
    if (request.internal.debugMode) {
      console.log('before', middlewareName);
      // console.log('Worker File - ', workerFile);
    }

    try {
      const ast = await parse(workerFile, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      // console.log('ast - ', JSON.stringify(ast.program.body, null, 4));
      const requiredModules: Record<string, any> = {};
      ast.program.body.forEach((node) => {
        console.log('node type - ', node.type);
        if (node.type === 'ImportDeclaration') {
          const moduleName = node.source.value;
          console.log('node.source.value; - ', node.source.value);
          if (moduleName.indexOf('@aws-sdk') === -1) {
            return;
          }
          node.specifiers.forEach((specifier) => {
            let localName: string;
            if (specifier.type === 'ImportSpecifier') {
              localName = (specifier.local as Identifier).name;
            } else {
              localName = (specifier.local as Identifier).name;
            }
            requiredModules[localName] = require(moduleName);
          });
        }
      });

      // console.log('awsImports:', JSON.stringify(awsImports, null, 4));
      console.log(
        'Import Statements:',
        JSON.stringify(requiredModules, null, 4),
      );
      request.internal.AWS = {
        ...awsImports,
        ...requiredModules,
      };
      console.log('request.internal.AWS - ', Object.keys(request.internal.AWS));
      request.event.AWS = request.internal.AWS;
    } catch (err) {
      console.error('Error parsing or traversing AST:', err);
      throw err;
    }
  };

  return {
    before,
  };
};

export default withAwsImports;
