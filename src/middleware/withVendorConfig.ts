import middy from '@middy/core';
import { SkynetMessage, HandledSkynetMessage } from './sharedTypes';

import { fetchRecordsByQuery } from '../library/dynamo';
import { Options } from './sharedTypes';

const createWithVendorContext = (options: Options): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const before: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> = async (request): Promise<void> => {
    console.log(options.service);
    // Use ids to pull context
    request.internal.vendorConfig = fetchRecordsByQuery(options.AWS, {
      TableName: 'vendorConfig',
      ExpressionAttributeNames: { '#pk': 'service' },
      KeyConditionExpression: '#pk = :serv',
      ExpressionAttributeValues: {
        ':serv': { S: `${options.service}` },
      },
    });
  };

  return {
    before,
  };
};

export default createWithVendorContext;
