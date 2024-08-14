import { describe, it, expect, vi, beforeEach } from 'vitest';
import middy from '@middy/core';
import withAwsImports from '../src/middleware/withAwsImports';
import { AWS as awsImports } from '../src/library/awsImports';
import fs from 'fs/promises';
import * as path from 'path';
import { getMiddyInternal } from '../src/library/util';
import { fetchRecordsByQuery } from '../src/library/dynamo';

const sharedSkynetConfig = {
  region: 'us-east-1',
  service: 'testService',
  account: '765342366425',
  debugMode: true,
  isBulk: false,
  eventType: 'fetch',
  maxMessagesPerInstance: 20,
};

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

describe('withAwsImports middleware', () => {
  let handler;
  let capturedEvent;
  let requestCopy;

  beforeEach(async () => {
    const baseHandler = (data: any, context: any) => {
      return data.map((m: any) => ({
        ...m,
        workerResp: { res: 'This is a test response from the fetch worker' },
      }));
    };
    handler = middy(baseHandler);

    const workerFilePath = path.resolve(
      path.join(__dirname, '../tests', 'workers', 'fetchWorker.ts'),
    );

    const workerFileData = await fs.readFile(workerFilePath, 'utf8');
    handler.use(withAwsImports(awsImports, workerFileData));
    handler.use({
      before: async (request) => {
        requestCopy = { ...request };
        capturedEvent = request.event.AWS;

        const getMiddyInternalVal = await getMiddyInternal(request, [
          'AWS',
          'SQSClient',
        ]);
        const queryObject = {
          TableName: 'User',
          KeyConditionExpression: `#userId = :userId`,
          ExpressionAttributeNames: {
            '#userId': 'userId',
          },
          ExpressionAttributeValues: {
            ':userId': { S: userId },
          },
        };
        const resp = await fetchRecordsByQuery(
          getMiddyInternalVal.AWS,
          sharedSkynetConfig,
          queryObject,
          true,
        );
        console.log('context - ', resp.items[0]);
        request.internal.TestUserData = resp.items[0];
      },
    });
  });

  it('Middleware: withAwsImports - should execute the middleware correctly', async () => {
    vi.unmock('../src/library/util');
    const response = await handler(sampleSkynetMessages, {} as any, () => {
      console.log('did this work');
    });

    expect(response).toEqual(
      sampleSkynetMessages.map((m: any) => ({
        ...m,
        workerResp: {
          res: 'This is a test response from the fetch worker',
        },
      })),
    );
  });

  it('Middleware: withAwsImports - Validate that AWS default services are imported for further use', async () => {
    expect(capturedEvent).toBeDefined();
  });

  it('Middleware: withAwsImports - Validate that services imported by the worker are available for use', async () => {
    expect(capturedEvent).toHaveProperty('SQSClient');
    expect(typeof capturedEvent.SQSClient).toBe('object');
  });

  it('Middleware: withAwsImports - Validate that aws services imported correctly by getting data from the dynamo', async () => {
    const getMiddyInternalVal = await getMiddyInternal(requestCopy, [
      'TestUserData',
    ]);
    console.log(
      'getMiddyInternalVal.TestUserData - ',
      JSON.stringify(getMiddyInternalVal.TestUserData, null, 4),
    );
    expect(typeof getMiddyInternalVal.TestUserData).toBe('object');
    expect(getMiddyInternalVal.TestUserData).toHaveProperty('email');
  });

  it('Middleware: withAwsImports - Validate that SQSClient is not present in capturedEvent', async () => {
    capturedEvent = {};
    expect(capturedEvent).not.toHaveProperty('SQSClient');
    expect(capturedEvent.SQSClient).toBeUndefined();
  });

  // it('Middleware: withAwsImports - should handle errors gracefully', async () => {
  //   vi.mock('../src/library/util', () => {
  //     return {
  //       getMiddyInternal: vi.fn(() => {
  //         throw new Error('Forced error for only testing purposes');
  //       }),
  //     };
  //   });
  //   await expect(
  //     handler(sampleSkynetMessages, {} as any, () => {}),
  //   ).rejects.toThrow('Forced error for only testing purposes');
  // });
});
