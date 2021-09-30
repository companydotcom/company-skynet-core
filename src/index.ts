import middy from '@middy/core';
import { neverThrowError } from './library/util';
import withMessageProcessing from './middleware/withMessageProcessing';
import withServiceData from './middleware/withMessageProcessing';
import withThrottling from './middleware/withThrottling';
import withVendorConfig from './middleware/withVendorConfig';
import withContextPrep from './middleware/withContextPrep';
import {
  CoreSkynetConfig,
  SkynetMessage,
  AllowableConfigKeys,
  Options,
  addToEventContext,
  prepareMiddlewareDataForWorker,
  getMiddyInternal,
} from './middleware/sharedTypes';

import { handler as gpH } from './handlers/getPostHttp';
import { handler as sDb } from './handlers/setupDatabase';

const createTailoredOptions = (
  keys: Array<AllowableConfigKeys>,
  skynetConfig: CoreSkynetConfig,
  AWS?: any,
): Options => {
  return keys.reduce(
    (opt, key) => ({
      ...opt,
      [key]: skynetConfig[key],
    }),
    AWS ? { AWS } : {},
  );
};

export default async (
  AWS: any,
  skynetConfig: CoreSkynetConfig,
  worker: Function,
  additionalMiddleware: [(opt: Options) => middy.MiddlewareObj],
) => {
  const handler = middy(async (request) => {
    const data = await getMiddyInternal(request, ['vendorConfig']);
    return Promise.all(
      // opportunity to adjust call signature of the worker to best suit this approach
      request.event.map((m: SkynetMessage) =>
        neverThrowError(
          {
            message: m.msgBody,
            attributes: m.msgAttribs,
            serviceConfigData: data.vendorConfig,
            ...prepareMiddlewareDataForWorker(request, m),
          },
          worker,
        ).then((workerResp: any) => {
          return {
            ...m,
            workerResp,
          };
        }),
      ),
    );
  });

  let middleware: Array<any>;
  switch (skynetConfig.eventType) {
    case 'webhook':
      middleware = [
        withMessageProcessing(
          createTailoredOptions(
            ['isBulk', 'eventType', 'service', 'maxMessagesPerInstance', 'region', 'account'],
            skynetConfig,
            AWS,
          ),
        ),
        withVendorConfig(createTailoredOptions(['service'], skynetConfig, AWS)),
        ...additionalMiddleware.map((mid) =>
          mid(createTailoredOptions(['service', 'eventType', 'isBulk'], skynetConfig, false)),
        ),
      ];
      break;
    case 'fetch':
    case 'transition':
      middleware = [
        withMessageProcessing(
          createTailoredOptions(
            ['isBulk', 'eventType', 'service', 'maxMessagesPerInstance', 'region', 'account'],
            skynetConfig,
            AWS,
          ),
        ),
        withContextPrep(createTailoredOptions([], skynetConfig, AWS)),
        withVendorConfig(createTailoredOptions(['service'], skynetConfig, AWS)),
        withServiceData(createTailoredOptions(['service', 'region', 'account'], skynetConfig, AWS)), // will now be MADS
        ...additionalMiddleware.map((mid) =>
          mid(createTailoredOptions(['service', 'eventType', 'isBulk'], skynetConfig, false)),
        ),
      ];

      if (skynetConfig.useThrottling) {
        middleware.unshift(
          withThrottling(createTailoredOptions(['service', 'isBulk', 'throttleOptions'], skynetConfig, AWS)),
        );
      }
      break;
    default:
      middleware = [];
  }

  return middleware.reduce((middyHandler, midlw) => middyHandler.use(midlw), handler);
};

/**
 * This is the fetch request handler
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {Object} d is the data to be saved
 * @param {string} s service is the name of the service
 */
export const setupDatabase = async (AWS: any, d: any, s: string) => {
  let data = '';
  if (typeof d === 'object') {
    data = d;
  } else {
    try {
      data = JSON.parse(d);
    } catch (e) {
      console.log('Unable to parse the database file. Please check if it is a valid JSON document.');
      return;
    }
  }
  // eslint-disable-next-line consistent-return
  return sDb(AWS, data, s);
};

// TODO: I think we should be able to kill this - I'm not sure what currently uses it, it was a Bharath add.  Http requests should go through management-svc, we don't need a separate endpoint on every service just to push the request into SNS
/**
 * This is the get http request handler
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} r is the region of AWS that this service is running in
 * @param {string} s service is the name of the service
 * @param {string} a account is AWS the account number
 * @param {object} b is the event input
 */
export const httpReqHandler = async (AWS: any, r: string, s: string, a: string, b: any, c: any) =>
  gpH(AWS, r, s, a, b, c);

export const utils = {
  addToEventContext,
};
