import middy from '@middy/core';
import { getInternal } from '@middy/util';
import { neverThrowError } from './library/util';
import withMessageProcessing from './middleware/withMessageProcessing';
import withServiceData from './middleware/withMessageProcessing';
import withThrottling from './middleware/withThrottling';
import withVendorConfig from './middleware/withVendorConfig';
import { CoreSkynetConfig } from './middleware/sharedTypes';

import { handler as sDb} from './handlers/setupDatabase';


const createTailoredOptions = (keys, skynetConfig, AWS) => {
  return keys.reduce((opt, key) => ({
    ...opt,
    [key]: skynetConfig[key],
  }), AWS ? { AWS } : {})
}

export const useSkynet = async (AWS, skynetConfig: CoreSkynetConfig, worker, additionalMiddleware = []) => {
  let handler = middy((request) => {
    const data = getInternal(['messagesToProcess', 'vendorConfig'], request);
    return Promise.all(
      // opportunity to adjust call signature of the worker to best suit this approach
        data.messagesToProcess(m => neverThrowError({
          message: m.msgBody,
          attributes: m.msgAttributes,
          serviceConfigData: data.vendorConfig,
          serviceAccountData: m.serviceUserData,
          serviceUserData: m.serviceUserData,
          // TODO: Figure out how to omit serviceAccountData/serviceUserData when that is not in use (webhooks)
          // TODO: Decide way for custom middleware to supply arbitrary data
        }, worker).then(workerResp => {
          m.workerResp = workerResp;
          return m;
        })
      ))
  });

  let middleware;
  switch(skynetConfig.eventType) {
    case 'webhook':
      middleware = [
        withMessageProcessing(createTailoredOptions(['isBulk', 'eventType', 'service', 'maxMessagesPerInstance', 'region', 'account'], skynetConfig, AWS)),
        withVendorConfig(createTailoredOptions(['service'], skynetConfig, AWS)),
        ...additionalMiddleware.map(mid => mid(createTailoredOptions(['service', 'eventType', 'isBulk'], skynetConfig, false))),
      ];
      break;
    case 'fetch':
    case 'transition':
      middleware = [
        withMessageProcessing(createTailoredOptions(['isBulk', 'eventType', 'service', 'maxMessagesPerInstance', 'region', 'account'], skynetConfig, AWS)),
        withVendorConfig(createTailoredOptions(['service'], skynetConfig, AWS)),
        withServiceData(createTailoredOptions(['service', 'region', 'account'], skynetConfig, AWS)),
        ...additionalMiddleware.map(mid => mid(createTailoredOptions(['service', 'eventType', 'isBulk'], skynetConfig, false))),
      ];

      if (skynetConfig.useThrottling) {
        middleware.unshift(withThrottling(createTailoredOptions(['service', 'isBulk', 'throttleOptions'], skynetConfig, AWS)))
      }
      break;
    default:
      middleware = [];
  }

  return middleware.reduce((middyHandler, midlw) => middyHandler.use(midlw), handler)
};

/**
 * This is the fetch request handler
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {Object} d is the data to be saved
 * @param {string} s service is the name of the service
 */
export const setupDatabase = async (AWS, d, s) => {
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
export const httpReqHandler = async (AWS, r, s, a, b, c) => gpH(
  AWS, r, s, a, b, c,
);
