import middy from '@middy/core';
import {
  SkynetMessage,
  HandledSkynetMessage,
  Options,
} from '../library/sharedTypes';

import { fetchRecordsByQuery } from '../library/dynamo';

const createWithVendorConfig = (
  options: Options
): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const middlewareName = 'withVendorConfig';
  const before: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> =
    async (request): Promise<void> => {
      if (options.debugMode) {
        console.log('before', middlewareName);
      }
      console.log('Service name:', options.service);
      // Use ids to pull context
      request.internal.vendorConfig = fetchRecordsByQuery(options.AWS, {
        TableName: 'vendorConfig',
        ExpressionAttributeNames: { '#pk': 'service' },
        KeyConditionExpression: '#pk = :serv',
        ExpressionAttributeValues: {
          ':serv': { S: `${options.service}` },
        },
      }).then((items: any[]) => items[0].configdata);
    };

  return {
    before,
  };
};

export default createWithVendorConfig;
