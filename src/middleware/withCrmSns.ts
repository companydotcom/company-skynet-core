import middy from '@middy/core';
import { getInternal }  from '@middy/util';
import { SQSEvent } from 'aws-lambda';
import es from '../library/eventStream';
import { itemExists } from '../library/util';

const defaults = {
  region: 'us-east-1',
};

type Options = {
  region: string;
  service: string;
  account: string;
  AWS: any;
}

const createWithThrottling = (opt: Options): middy.MiddlewareObj<SQSEvent, any> => {
  const options = { ...defaults, ...opt };

  const after: middy.MiddlewareFn<SQSEvent, any> = async (
    request
  ): Promise<void> => {
    const { AWS, service, region, account } = options;
    const data = await getInternal('messagesToProcess', request);
    // set changes to serviceUserData/serviceAccountData
    await Promise.all(data.messagesToProcess.map(async m => {
      const {msgBody, msgAttribs } = m;
      if (itemExists(m.workerResp, 'crmData')) {
        if (typeof m.workerResp.crmData !== 'object') {
          throw new Error('Data going to a CRM should be an object');
        }
        if (Object.keys(m.workerResp.crmData).length > 0) {
          await es.publish(
            AWS,
            `arn:aws:sns:${region}:${account}:event-bus`,
            {
              ...msgBody,
              payload: m.workerResp.crmData,
              metadata: {
                eventType: 'sendFields',
                dateCreated: Date.now(),
                operationType: 'update',
                invocationSource: service,
              },
            },
            {
              ...msgAttribs,
              status: 'trigger',
              eventType: 'crm',
              eventId: uuid(),
              emitter: service,
            },
          );
        }
      }
    }));
  };

  return {
    after,
  };
};

export default createWithThrottling;
