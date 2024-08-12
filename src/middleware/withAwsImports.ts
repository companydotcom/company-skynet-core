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
    console.log('Running withAwsImports middleware - BEFORE');
    if (request.internal.debugMode) {
      console.log('before', middlewareName);
      console.log('Worker File - ', workerFile);
    }

    try {
      const ast = await parse(workerFile, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      // console.log('ast - ', JSON.stringify(ast.program.body, null, 4));
      const imports: any[] = [];
      ast.program.body.forEach((node) => {
        // console.log('node type - ', node.type);
        if (node.type === 'ImportDeclaration') {
          const importStatement = {
            source: node.source.value,
            specifiers: node.specifiers.map((specifier) => {
              if (specifier.type === 'ImportSpecifier') {
                const importedName = (specifier.imported as Identifier).name;
                const localName = (specifier.local as Identifier).name;
                return {
                  type: specifier.type,
                  imported: importedName,
                  local: localName,
                };
              } else {
                const localName = (specifier.local as Identifier).name;
                return {
                  type: specifier.type,
                  local: localName,
                };
              }
            }),
          };
          imports.push(importStatement);
        }
      });

      // console.log('Import Statements:', imports);

      request.internal.AWS = {
        ...awsImports,
        ...imports,
      };
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
