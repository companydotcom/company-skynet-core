import withThrottling from '../src/middleware/withThrottling';
import middy from '@middy/core';
import AWS from 'aws-sdk';
import { Options } from '../src/library/sharedTypes';
import { getMiddyInternal } from '../src/library/util';

AWS.config.update({ region: process.env.region });

const userId = '60ee01f8885a9700717e8d8e';
const accountId = 'abc3d3d7-61ef-4635-806c-e54016ad7dce';

const middlewareToTest = [withThrottling];

const coreSettings = {
  AWS,
  region: process.env.region,
  service: process.env.service,
  account: process.env.accountId,
  useThrottling: true,
  throttleOptions: {
    throttleLmts: JSON.stringify({
      second: 60,
    }),
    safeThrottleLimit: 0.9,
    reserveCapForDirect: 0.2,
    retryCntForCapacity: 3,
  },
  maxMessagesPerInstance: 20,
  isBulk: true,
  eventType: 'fetch',
} as Options;

const test = async (event: any) => {
  const handler = (data: any) => {
    console.log('INTERIOR DATA', data);
    return data.map((m: any) => ({
      ...m,
      workerResp: {
        res: 'hello world',
        serviceUserData: {
          data: 'change',
        },
        serviceAccountData: {
          accountData: 'hello again',
          plus: 1,
        },
      },
    }));
  };

  const middifiedHandler = middy(handler);
  middifiedHandler.use(middlewareToTest[0](coreSettings));
  middifiedHandler.use({
    before: async (request) => {
      console.log('request.internal', request.internal);
      const data = await getMiddyInternal(request, ['availCap']);
      console.log('DATA FOR WORKER', data);
    },
  });

  await middifiedHandler(event, {} as any, () => {
    console.log('did this work');
  });
};

const sampleSkynetMessages = [
  {
    msgBody: {
      payload: {},
      context: {
        user: {
          userId,
          accountId,
        },
        account: {},
        product: {},
        tile: {},
      },
      metadata: {
        eventType: '/* EVENT NAME */',
        tileId: 'tile123',
      },
    },
    msgAttribs: {
      emitter: 'platform-events',
      eventId: 'aeab0921-0bdc-4e47-8968-c2b8c2b1a8f2',
      triggerEventId: '747099bd-48be-42ce-81e1-de80a7212713',
      entity: 'tile',
      entityId: 'abc123',
      operation: 'C',
      status: 'trigger',
      eventType: 'fetch',
    },
    rcptHandle: undefined,
  },
];

// const sampleBadEvent = {
//   hello: 'world',
// };

const run = async () => {
  // try {
  //   console.log('RUNNING BAD EVENT');
  //   await test(sampleBadEvent);
  // } catch (err) {
  //   console.log('This should have erred', err);
  // }

  try {
    console.log('RUNNING GOOD EVENT');
    await test(sampleSkynetMessages);
  } catch (err) {
    console.log('This should not have erred', err);
  }
};

run();
