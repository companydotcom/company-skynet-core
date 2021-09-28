import middy from '@middy/core';
import { getInternal } from '@middy/util';
import { SQSEvent, ScheduledEvent, SNSEvent } from 'aws-lambda';
import { v4 as uuid } from 'uuid';

import es from '../library/eventStream';

import {
  getMsgsFromQueue,
  parseMsg as sqsParser,
  deleteMsg as deleteMsgFromQueue,
  sendMsg as sendSqsMsg,
} from '../library/queue';

import { incrementUsedCount } from '../library/throttle';
import { HandledSkynetMessage, RawEvent, SkynetMessage, Options } from './sharedTypes';

const defaults = {
  isBulk: false,
  service: '',
  AWS: {},
  region: '',
  queueName: '',
  account: '',
  maxMessagesPerInstance: 100,
};

const queueNameMap = {
  transition: 'bulktq',
  fetch: 'bulkfq',
};

type SettledOptions = {
  isBulk: boolean;
  eventType: 'transition' | 'fetch';
  service: string;
  region: string;
  account: string;
  AWS?: any;
  maxMessagesPerInstance: number;
};

// TODO: move this out to "withExtraStatus"
const getCompleteStatus = (procResult: any) => {
  let result = procResult.status;
  if (
    Object.prototype.hasOwnProperty.call(procResult, 'workerResp') &&
    Object.prototype.hasOwnProperty.call(procResult.workerResp, 'extraStatus')
  ) {
    result = `${result}-${procResult.workerResp.extraStatus}`;
  }
  return result;
};

const handleSingle = async (request: middy.Request, options: Options) => {
  // If there are no records to process or more than one record to process,
  // throw an error as it is an invalid event
  if (
    request.event.hasOwnProperty('Records') &&
    Array.isArray(request.event.Records) &&
    request.event.Records.length !== 1
  ) {
    throw new Error(
      `directTransition: ERROR: Lambda was wrongly triggered with ${
        typeof request.event.Records === 'undefined' ? 0 : request.event.Records.length
      } records`,
    );
  }
  request.event = [sqsParser(request.event.Records[0])];

  // TODO: Decide whether to keep this here or kick it out to throttle
  await incrementUsedCount(options.AWS, options.service || '', 1);
};

const handleBulk = async (request: middy.Request, options: SettledOptions) => {
  // check internal for if an "availCap" has been set
  if (options.isBulk) {
    const throttleResult = await getInternal(['availCap'], request);
    let availCap = Math.min(
      options.maxMessagesPerInstance || 500,
      throttleResult?.availCap || options.maxMessagesPerInstance,
    );
    const messagesToProcess = await getMsgsFromQueue(
      options.AWS,
      options.region,
      availCap,
      `https://sqs.${options.region}.amazonaws.com/${options.account}/${options.service}-${
        queueNameMap[options.eventType]
      }`,
    );
    console.log(`bulkTransition: INFO: Processing event ${JSON.stringify(messagesToProcess.length, null, 4)}`);

    // TODO: Decide whether to keep this here or kick it out to throttle
    await incrementUsedCount(options.AWS, options.service, messagesToProcess.length);

    request.event = messagesToProcess.map((m: SNSEvent) => sqsParser(m));
  }
};

const sendToDlq = async (message: SkynetMessage, options: SettledOptions, error: Error | null) => {
  const { region, account, service, AWS } = options;
  const { msgBody, msgAttribs } = message;
  await sendSqsMsg(
    AWS,
    region,
    `https://sqs.${region}.amazonaws.com/${account}/${service}-ldlq`,
    JSON.stringify({
      failedIn: service,
      body: {
        Message: msgBody,
        MessageAttributes: msgAttribs,
        Error: error,
      },
    }),
  );
};

function isScheduledEvent(obj: any): obj is ScheduledEvent {
  return obj.foo !== undefined;
}

function isSqsEvent(obj: any): obj is SQSEvent {
  return obj.Records !== undefined;
}

const createWithSqsHandling = (opt: Options): middy.MiddlewareObj<RawEvent, [HandledSkynetMessage]> => {
  const options = { ...defaults, ...opt } as SettledOptions;

  const sqsBefore: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> = async (request): Promise<void> => {
    if (isScheduledEvent(request.event) && options.isBulk) {
      await handleBulk(request, options);
    } else if (isSqsEvent(request.event)) {
      await handleSingle(request, options);
    } else {
      throw 'Bulk operations must be Scheduled Event Lambda Invocations, Single Operations must be SNS Event Lambda Invocations';
    }
  };

  const sqsAfter: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> = async (request): Promise<void> => {
    const { AWS, region, account, service } = options;
    const handledMessages = request.response;
    if (handledMessages) {
      await Promise.all(
        handledMessages.map(async (message: HandledSkynetMessage) => {
          const { rcptHandle, msgAttribs, workerResp, msgBody } = message;
          // Delete the message from the queue using the rcptHandle, if available.
          if (typeof rcptHandle !== 'undefined') {
            await deleteMsgFromQueue(
              AWS,
              region,
              msgAttribs.eventType === 'transition'
                ? `https://sqs.${region}.amazonaws.com/${account}/${service}-bulktq`
                : `https://sqs.${region}.amazonaws.com/${account}/${service}-bulkfq`,
              rcptHandle,
            );
          }

          if (workerResp.status && workerResp.status === 'fail') {
            sendToDlq(message, options, workerResp.error);
          }

          // Publish the response SNS event
          await es.publish(
            AWS,
            `arn:aws:sns:${region}:${account}:event-bus`,
            {
              ...msgBody,
              inputPayload: msgBody.payload,
              payload: workerResp.res,
            },
            {
              ...msgAttribs,
              status: getCompleteStatus(workerResp),
              eventId: uuid(),
              emitter: service,
            },
          );
        }),
      );
    }
  };

  const onError: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> = async (request): Promise<void> => {
    if (request.response && request.response.length) {
      const handledMessages = request.response;
      await Promise.all(
        handledMessages.map(async (m) => {
          await sendToDlq(m, options, request.error);
        }),
      );
    }
  };

  return {
    before: sqsBefore,
    after: sqsAfter,
    onError,
  };
};

export default createWithSqsHandling;
