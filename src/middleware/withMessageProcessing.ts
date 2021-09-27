import middy from '@middy/core';
import { getInternal }  from '@middy/util';
import { SQSEvent, ScheduledEvent } from 'aws-lambda';
import uuid from 'uuid/v4';

import es from '../library/eventStream';

import {
  getMsgsFromQueue,
  parseMsg as sqsParser,
  deleteMsg as deleteMsgFromQueue,
  sendMsg as sendSqsMsg,
} from '../library/queue';

import {
  incrementUsedCount,
} from '../library/throttle';
import { HandledMessage, MiddlewareEvent } from './sharedTypes';

const defaults = {
  isBulk: false,
  service: '',
  AWS: {},
  region: '',
  queueName: '',
  account: '',
  maxMessagesPerInstance: 100,
};

type Options = {
  isBulk: boolean;
  eventType: 'transition' | 'fetch';
  service: string;
  region: string;
  account: string;
  defaultMaxMessages: number;
  AWS: any;
}

const queueNameMap = {
  transition: 'bulktq',
  fetch: 'bulkfq',
}


const createWithSqsHandling = (opt: Options): middy.MiddlewareObj<SQSEvent, any> => {
  const options = { ...defaults, ...opt } as Options;

  const handleSingle = async (request) => {
    // If there are no records to process or more than one record to process,
    // throw an error as it is an invalid event
    if (typeof request.Records === 'undefined' || request.Records.length !== 1) {
      throw new Error(`directTransition: ERROR: Lambda was wrongly triggered with ${typeof request.Records === 'undefined' ? 0 : request.Records.length} records`);
    }
    request.event.messagesToProcess = [sqsParser(request.Records[0])];

    // TODO: Decide whether to keep this here or kick it out to throttle
    await incrementUsedCount(options.AWS, options.service, 1);
  }

  const handleBulk = async (request) => {
    // check internal for if an "availCap" has been set
    if (options.isBulk) {
      const throttleResult = getInternal(['availCap'], request);
      let availCap = Math.min(options.maxMessagesPerInstance, throttleResult?.availCap || options.maxMessagesPerInstance)
      const messagesToProcess = await getMsgsFromQueue(options.AWS, options.region, availCap,
        `https://sqs.${options.region}.amazonaws.com/${options.account}/${options.service}-${queueNameMap[options.eventType]}`);
      console.log(`bulkTransition: INFO: Processing event ${JSON.stringify(messagesToProcess.length, null, 4)}`);

      // TODO: Decide whether to keep this here or kick it out to throttle
      await incrementUsedCount(options.AWS, options.service, messagesToProcess.length);

      request.event.messagesToProcess = messagesToProcess.map(m => sqsParser(m))
    }
  }

  const sqsBefore: middy.MiddlewareFn<MiddlewareEvent, [HandledMessage]> = async (
    request
  ): Promise<void> => {
    if (options.isBulk) {
      await handleBulk(request)
    } else {
      await handleSingle(request)
    }
  };

  // TODO: move this out to "withExtraStatus"
  const getCompleteStatus = procResult => {
    let result = procResult.status;
    if (Object.prototype.hasOwnProperty.call(procResult, 'workerResp') && Object.prototype.hasOwnProperty.call(procResult.workerResp, 'extraStatus')) {
      result = `${result}-${procResult.workerResp.extraStatus}`;
    }
    return result;
  };

  const sqsAfter: middy.MiddlewareFn<MiddlewareEvent, [HandledMessage]> = async (
    request
  ): Promise<void> => {
    const { AWS, region, account, service } = options;
    const handledMessages = request.response;

    await Promise.all(messagesToProcess.map(async (message) => {
      const { rcptHandle, msgAttribs, workerResp, msgBody } = message;
      // Delete the message from the queue using the rcptHandle, if available.
      if (typeof rcptHandle !== 'undefined') {
        await deleteMsgFromQueue(
          AWS,
          region,
          msgAttribs.eventType === 'transition' ? `https://sqs.${region}.amazonaws.com/${account}/${service}-bulktq` : `https://sqs.${region}.amazonaws.com/${account}/${service}-bulkfq`,
          rcptHandle,
        );
      }

      if (workerResp.status && workerResp.status === 'fail') {
        sendToDlq(message, workerResp.error)
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
    }));
  };

  const sendToDlq = async (message, error) => {
    const {region, account, service, AWS} = options;
    const {msgBody, msgAttribs} = message;
    await sendSqsMsg(AWS,
      region,
      `https://sqs.${region}.amazonaws.com/${account}/${service}-ldlq`,
      JSON.stringify({
        failedIn: service,
        body: {
          Message: msgBody,
          MessageAttributes: msgAttribs,
          Error: error,
        },
      }),)
  };

  const onError: middy.MiddlewareFn<MiddlewareEvent, HandledMessage> = async (
    request
  ): Promise<void> => {
    const handledMessages = request.response;

    if (request.response && request.response.length) {
      const handledMessages = request.response;
      await Promise.all(handledMessages.map(async (m) => {
        await sendToDlq(m, request.error);
      }))
    }
  }

  return {
    before: sqsBefore,
    after: sqsAfter,
    onError,
  };
};

export default createWithSqsHandling;
