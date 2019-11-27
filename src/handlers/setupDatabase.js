import { batchPutIntoDynamoDb } from '../library/dynamo';
import { getErrorString } from '../library/util';

export const handler = async (AWS, data, service) => {
  try {
    const record = {
      service,
      data
    };
    const res = await batchPutIntoDynamoDb(AWS, [record], 'vendorConfig');
    console.log('Database has been setup successfully');
    return 'Database has been setup successfully';
  } catch (e) {
    console.log(`bulkTransition: ERROR: ${getErrorString(e)}`);
    throw e;
  }
}