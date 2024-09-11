import { describe, it, expect, beforeEach } from 'vitest';
import middy from '@middy/core';
import withAwsImports from '../src/middleware/withAwsImports';
import withThrottling from '../src/middleware/withThrottling';
import { AWS as awsImports } from '../src/library/awsImports';
import fs from 'fs/promises';
import * as path from 'path';
import { getMiddyInternal } from '../src/library/util';
// import { fetchRecordsByQuery } from '../src/library/dynamo';
import { Options } from '../src/library/sharedTypes';

// const sharedSkynetConfig = {
//   region: 'us-east-1',
//   service: 'testService',
//   account: '765342366425',
//   debugMode: true,
//   isBulk: false,
//   eventType: 'fetch',
//   maxMessagesPerInstance: 20,
// };

const userId = '6332a2f75bafd02fb95e5c22';
const accountId = 'bf6318f2-6d0b-4703-9c53-e776f04b3957';

const coreSettings = {
  region: 'us-east-1',
  service: 'techsupport-asi',
  account: '765342366425',
  useThrottling: true,
  maxMessagesPerInstance: 10,
  isBulk: true,
  eventType: 'fetch',
  throttleOptions: {
    throttleLmts: JSON.stringify({
      second: 60,
    }),
    safeThrottleLimit: 0.9,
    reserveCapForDirect: 0.2,
    retryCntForCapacity: 3,
  },
} as Options;

const sampleSkynetMessages = [
  {
    EventSource: 'aws:sns',
    EventVersion: '1.0',
    EventSubscriptionArn:
      'arn:aws:sns:us-east-1:811255529278:event-bus:a7f1d3a5-8109-4972-a4d3-5e69f7caee1a',
    body: {
      Type: 'Notification',
      MessageId: '07a72944-bda4-5820-9752-7c9a92ad84af',
      TopicArn: 'arn:aws:sns:us-east-1:811255529278:event-bus',
      Subject: null,
      MessageAttributes: {
        emitter: {
          Type: 'String',
          Value: 'platform-events',
        },
        eventId: {
          Type: 'String',
          Value: 'aeab0921-0bdc-4e47-8968-c2b8c2b1a8f2',
        },
        triggerEventId: {
          Type: 'String',
          Value: '747099bd-48be-42ce-81e1-de80a7212713',
        },
        entity: {
          Type: 'String',
          Value: 'tile',
        },
        entityId: {
          Type: 'String',
          Value: 'abc123',
        },
        operation: {
          Type: 'String',
          Value: 'C',
        },
        status: {
          Type: 'String',
          Value: 'trigger',
        },
        eventType: {
          Type: 'String',
          Value: 'fetch',
        },
      },
      Message: {
        payload: {},
        internalMicroAppData: {
          testINternalMicroAppData: {
            test: 'test',
          },
        },
        context: {
          token:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdkWFVPVnlOWGprczdSLW4wSEVhRiJ9.eyJodHRwczovL2NvbXBhbnkuY29tL3VzZXJfYXV0aG9yaXphdGlvbiI6eyJncm91cHMiOlsiU291cmNlOmNvbXBhbnkiLCJBY2NvdW50Ojc2MDgwMGU1LWFmMjMtNDUzZC05ZDViLTA2MzQ0OTRlYjNlNCJdLCJsb2dpbnNDb3VudCI6Nywicm9sZXMiOlsiYWRtaW4iXSwidXNlcnNJblNjb3BlIjpbImF1dGgwfDY2ODJlOWRlNDZlMDRiMjZhMjE3MTYyOCJdfSwiaXNzIjoiaHR0cHM6Ly9pZC1kZXYuY29tcGFueS1jb3JwLmNvbS8iLCJzdWIiOiJhdXRoMHw2NjgyZTlkZTQ2ZTA0YjI2YTIxNzE2MjgiLCJhdWQiOlsiaHR0cHM6Ly9jb21wYW55LWNvcnAtZGV2eC5hdXRoMC5jb20vYXBpL3YyLyIsImh0dHBzOi8vY29tcGFueS1jb3JwLWRldnguYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTcyMjI0NTYxMiwiZXhwIjoxNzIyMzMyMDEyLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoidDlpVDN3cFNNM2ltVmdpQnZ6N29iMmRIT0hDWGxaR1UifQ.i5lEhc9eonhzOXVmfnzayJcwmsQDgC5edj29p0Rs-INrPmt9bAN_ym2_LUSPnVnBrPPW8g-0hOsEH_ccvz-CeloXGaQOMpO6LBLjKCJ1mYiv9r14atCUsGvZlJBt6V9RKbc_g39juANux5Rnsk_eC4F4HVdcytUFiRCGxuIx1qtmmVPPLi_xdK5itGwerju_3MHLMbN_f86_1MdIbgjNi6JQNiGGKiI_4NpiJowF-tIVNiu1aERjex6qCE7adZ5H8fSH4wseIE_MbmmL0t2HcUC9WkBMQAf9cNHs9gSyy0NNNQLmbI9HJkIwq25y4ucOngaOZs5Yg_iYZumdGhMStA',
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
    },
  },
];

describe('withAwsImports middleware', () => {
  let handler: any;
  let requestCopy: any;

  beforeEach(async () => {
    const baseHandler = (data: any, context: any) => {
      console.log('context - ', context.length);
      return data.map((m: any) => ({
        ...m,
        workerResp: { res: 'This is a test response from the worker' },
      }));
    };
    handler = middy(baseHandler);

    const workerFilePath = path.resolve(
      path.join(__dirname, '../tests', 'workers', 'fetchWorker.ts'),
    );

    const workerFileData = await fs.readFile(workerFilePath, 'utf8');
    handler.use(withAwsImports(awsImports, workerFileData));
    handler.use(withThrottling(coreSettings));
    handler.use({
      before: async (request: any) => {
        requestCopy = { ...request };
        const data = await getMiddyInternal(request, ['availCap']);
        console.log('DATA FOR WORKER', data);
        request.internal.MiddleWareResp = data;
      },
    });
  });

  it('Middleware: withThrottling - should execute the middleware correctly', async () => {
    // vi.unmock('../src/library/util');
    const response = await handler(sampleSkynetMessages, {} as any, () => {
      console.log('did this work');
    });

    expect(response).toEqual(
      sampleSkynetMessages.map((m: any) => ({
        ...m,
        workerResp: {
          res: 'This is a test response from the worker',
        },
      })),
    );
  });

  it('Middleware: withThrottling - Available capacity should be returned in middyInternal for use in other middlewares', async () => {
    const getMiddyInternalVal = await getMiddyInternal(requestCopy, [
      'MiddleWareResp',
    ]);
    console.log(
      'getMiddyInternalVal.MiddleWareResp - ',
      JSON.stringify(getMiddyInternalVal.MiddleWareResp, null, 4),
    );
    expect(typeof getMiddyInternalVal.MiddleWareResp).toBe('object');
    expect(getMiddyInternalVal.MiddleWareResp).toHaveProperty('availCap');
    expect(typeof getMiddyInternalVal.MiddleWareResp.availCap).toBe('number');
  });
});
