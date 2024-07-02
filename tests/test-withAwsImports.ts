import { AWS as awsImports } from '../src/library/awsImports';
import withAwsImports from '../src/middleware/withAwsImports';
import middy from '@middy/core';
import { getMiddyInternal } from '../src/library/util';
// import { AWS } from '../src/library/awsImports';
import { Options } from '../src/library/sharedTypes';
import { fetchRecordsByQuery } from '../src/library/dynamo';
import fs from 'fs/promises';
import * as path from 'path';
// import * as ts from 'typescript';



// const coreSettings = {
//   region: 'us-east-1',
//   service: 'dynamodb',
//   account: accountId,
//   useThrottling: false,
//   maxMessagesPerInstance: 20,
//   isBulk: false,
//   eventType: 'fetch',
// } as Options;

const sharedSkynetConfig: Options = {
  region: 'us-east-1',
  service: 'testService',
  account: '765342366425',
  debugMode: true,
  isBulk: false,
  eventType: 'fetch',
  maxMessagesPerInstance: 20,
};

// Prepare the event for testing

const userId = '6332a2f75bafd02fb95e5c22';
const accountId = 'bf6318f2-6d0b-4703-9c53-e776f04b3957';

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
        eventType: 'testCase',
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

const test = async (event: any) => {
  const handler = (data: any) => {
    console.log('INTERIOR DATA', JSON.stringify(data, null, 4));
    return data.map((m: any) => ({ ...m, workerResp: { res: 'hello world' } }));
  };

  const middifiedHandler = middy(handler);
  const getWorkerFilePath = () => {
    // const baseDir = process.env.NODE_ENV === 'development' ? __dirname : path.join(__dirname, '../src');
    return path.resolve(path.join(__dirname, '../../tests', 'workers', 'fetchWorker.ts'));
  };
  const workerFilePath = getWorkerFilePath();;
  // const workerFilePath = `./workers/fetchWorker.ts`;
  const workerFileData = await fs.readFile(workerFilePath, 'utf8');
  middifiedHandler.use(withAwsImports(awsImports, workerFileData));
  middifiedHandler.use({
    before: async (request) => {
      const getMiddyInternalVal = await getMiddyInternal(request, [
        'AWS',
        'SQSClient'
      ]);
      console.log('SQS ---------------');
      console.log(getMiddyInternalVal.SQSClient);
      const queryObject = {
        TableName: 'User',
        KeyConditionExpression: `#userId = :userId`,
        ExpressionAttributeNames: {
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':userId': { S: '6332a2f75bafd02fb95e5c22' },
        },
      }
      const resp = await fetchRecordsByQuery(
        getMiddyInternalVal.AWS,
        sharedSkynetConfig,
        queryObject,
        true,
      );
      console.log('context - ', resp.items[0]);
    },
  });

  await middifiedHandler(event, {} as any, () => {
    console.log('did this work');
  });
};

const run = async () => {
  try {
    console.log('RUNNING GOOD EVENT');
    await test(sampleSkynetMessages);
  } catch (err) {
    console.log('This should not have erred', err);
  }
};

run();
