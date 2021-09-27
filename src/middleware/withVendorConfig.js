import { fetchRecordsByQuery } from '../library/dynamo';

const createWithVendorContext = options => {
  const userContextBefore = request => {
    // Use ids to pull context
    request.internal.vendorConfig = fetchRecordsByQuery(
      options.AWS,
      {
        TableName: 'vendorConfig',
        ExpressionAttributeNames: { '#pk': 'service' },
        KeyConditionExpression: '#pk = :serv',
        ExpressionAttributeValues: {
          ':serv': { S: `${options.service}` },
        },
      },
    );
  };

  return {
    before: userContextBefore,
  };
};

export default createWithVendorContext;
