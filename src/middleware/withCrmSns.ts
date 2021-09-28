import middy from '@middy/core';
import { getInternal } from '@middy/util';
import es from '../library/eventStream';
import uuid from 'uuid/v4';
import { itemExists } from '../library/util';
import { SkynetMessage, HandledSkynetMessage, Options } from './sharedTypes';

const defaults = {
  region: 'us-east-1',
};

const createWithCrm = (opt: Options): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const options = { ...defaults, ...opt };

  const after: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> = async (request): Promise<void> => {
    const { AWS, service, region, account } = options;
    // set changes to serviceUserData/serviceAccountData
    if (request.response) {
      await Promise.all(
        request.response.map(async (m: HandledSkynetMessage) => {
          const { msgBody, msgAttribs } = m;
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
        }),
      );
    }
  };

  return {
    after,
  };
};

export default createWithCrm;
