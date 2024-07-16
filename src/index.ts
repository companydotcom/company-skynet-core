import middy from '@middy/core';
import { addToEventContext, neverThrowError } from './library/util';
// import { AWS } from './library/awsImports';
import withAwsImports from './middleware/withAwsImports';
import withInputValidation from './middleware/withInputValidation';
import withTokenValidationAndContextPrep from './middleware/withTokenValidationAndContextPrep';
import withVendorConfig from './middleware/withVendorConfig';
import withServiceData from './middleware/withServiceData';
import withMads from './middleware/withMads';
import withPrivacyScreen from './middleware/withPrivacyScreen';
import withThrottling from './middleware/withThrottling';
// import withCrmData from './middleware/withCrmData';
// import { fetchRecordsByQuery } from './library/dynamo';
import {
  CoreSkynetConfig,
  SkynetMessage,
  AllowableConfigKeys,
  Options,
} from './library/sharedTypes';
// import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const createTailoredOptions = (
  keys: Array<AllowableConfigKeys>,
  skynetConfig: CoreSkynetConfig,
): Options => {
  return keys.reduce(
    (opt, key) => ({
      ...opt,
      [key]: skynetConfig[key],
    }),
    {} as Options,
  );
};

export const useSkynet = async (
  AWS: any,
  skynetConfig: any,
  worker: (params: any) => any,
  workerFile: string,
  additionalMiddleware: [(opt: Options) => middy.MiddlewareObj],
) => {
  console.log('skynetConfig', JSON.stringify(skynetConfig, null, 4));

  // console.log('Preparing Skynet Handler');
  const handler = middy(async (event: any) => {
    console.log('Delegating processed messages to worker:');
    return Promise.all(
      // opportunity to adjust call signature of the worker to best suit this approach
      event.map((m: SkynetMessage) =>
        neverThrowError(m, worker).then((result: any) => {
          console.log(
            'Received worker response',
            JSON.stringify(result.workerResp, null, 2),
          );
          return {
            ...result,
            ...result.params,
          };
        }),
      ),
    );
  });

  let middleware: Array<any>;
  switch (skynetConfig.eventType) {
    // case 'webhook':
    //   middleware = [
    //     withMessageProcessing(
    //       createTailoredOptions(
    //         [
    //           'isBulk',
    //           'eventType',
    //           'service',
    //           'maxMessagesPerInstance',
    //           'region',
    //           'account',
    //           'debugMode',
    //         ],
    //         skynetConfig,
    //         AWS
    //       )
    //     ),
    //     ...(skynetConfig.hasServiceConfig
    //       ? [
    //           withVendorConfig(
    //             createTailoredOptions(
    //               ['service', 'debugMode'],
    //               skynetConfig,
    //               AWS
    //             )
    //           ),
    //         ]
    //       : []),
    //     withPrivacyScreen(
    //       createTailoredOptions(['debugMode'], skynetConfig, AWS)
    //     ),
    //     ...additionalMiddleware.map((mid) =>
    //       mid(
    //         createTailoredOptions(
    //           ['service', 'eventType', 'isBulk', 'debugMode'],
    //           skynetConfig,
    //           false
    //         )
    //       )
    //     ),
    //   ];
    //   break;
    case 'fetch':
    case 'transition':
      // Add another middleware here at the begeinning of the array which will take the workerFile and pass it to
      // the worker

      middleware = [
        // withTokenProcessingAndSNSPublishing
        withInputValidation(
          createTailoredOptions(
            [
              'isBulk',
              'eventType',
              'service',
              'maxMessagesPerInstance',
              'region',
              'account',
              'debugMode',
            ],
            skynetConfig,
          ),
        ),
        withTokenValidationAndContextPrep(
          createTailoredOptions(['debugMode'], skynetConfig),
        ),
        ...(skynetConfig.hasServiceConfig
          ? [
              withVendorConfig(
                createTailoredOptions(['service', 'debugMode'], skynetConfig),
              ),
            ]
          : []),
        ...(skynetConfig.useMads
          ? [
              withServiceData(
                createTailoredOptions(
                  ['service', 'region', 'account', 'debugMode'],
                  skynetConfig,
                ),
              ),
              withMads(
                createTailoredOptions(
                  ['service', 'region', 'account', 'debugMode'],
                  skynetConfig,
                ),
              ),
            ]
          : [
              withServiceData(
                createTailoredOptions(
                  ['service', 'region', 'account', 'debugMode'],
                  skynetConfig,
                ),
              ),
            ]), // eventually swap for Mads as default
        withPrivacyScreen(createTailoredOptions(['debugMode'], skynetConfig)),
        ...additionalMiddleware.map((mid) =>
          mid(
            createTailoredOptions(
              ['service', 'eventType', 'isBulk', 'debugMode'],
              skynetConfig,
            ),
          ),
        ),
      ];

      if (skynetConfig.useThrottling) {
        middleware.unshift(
          withThrottling(
            createTailoredOptions(
              ['service', 'isBulk', 'throttleOptions'],
              skynetConfig,
            ),
          ),
        );
      }
      middleware.unshift(withAwsImports(AWS, workerFile));
      break;
    default:
      middleware = [];
  }
  console.log(
    'middleware -------------------------------------------------------------------------------------------------------------------',
  );
  console.log('Applying', middleware.length, 'middlewares.');
  return middleware.reduce(
    (middyHandler, midlw) => middyHandler.use(midlw),
    handler,
  );
};

export const utils = {
  addToEventContext,
};

// export const middleware = {
//   withCrmData,
// };

export { CoreSkynetConfig };
