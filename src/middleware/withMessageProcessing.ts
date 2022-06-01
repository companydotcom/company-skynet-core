import middy from '@middy/core';
import { SQSEvent, ScheduledEvent, SNSEvent } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import { getMiddyInternal } from '../library/util';
import redis from 'redis';

import es from '../library/eventStream';

import {
  getMsgsFromQueue,
  parseMsg as sqsParser,
  deleteMsg as deleteMsgFromQueue,
  sendMsg as sendSqsMsg,
} from '../library/queue';

import {
  HandledSkynetMessage,
  RawEvent,
  SkynetMessage,
  Options,
} from '../library/sharedTypes';

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
  debugMode?: boolean;
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

const handleSingle = async (request: middy.Request) => {
  // If there are no records to process or more than one record to process,
  // throw an error as it is an invalid event
  if (
    request.event.hasOwnProperty('Records') &&
    Array.isArray(request.event.Records) &&
    request.event.Records.length !== 1
  ) {
    throw new Error(
      `directTransition: ERROR: Lambda was wrongly triggered with ${
        typeof request.event.Records === 'undefined'
          ? 0
          : request.event.Records.length
      } records`
    );
  }
  request.event = [sqsParser(request.event.Records[0])];
};

const handleBulk = async (request: middy.Request, options: SettledOptions) => {
  // check internal for if an "availCap" has been set
  if (options.isBulk) {
    const throttleResult = await getMiddyInternal(request, ['availCap']);
    const availCap = Math.min(
      options.maxMessagesPerInstance || 500,
      throttleResult?.availCap || options.maxMessagesPerInstance
    );
    const messagesToProcess = await getMsgsFromQueue(
      options.AWS,
      options.region,
      availCap,
      `https://sqs.${options.region}.amazonaws.com/${options.account}/${
        options.service
      }-${queueNameMap[options.eventType]}`
    );
    console.log(
      `bulkTransition: INFO: Processing event ${JSON.stringify(
        messagesToProcess.length,
        null,
        4
      )}`
    );

    request.event = messagesToProcess.map((m: SNSEvent) => sqsParser(m));
  }
};

const sendToDlq = async (
  message: SkynetMessage,
  options: SettledOptions,
  error: Error | null
) => {
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
    })
  );
};

function isScheduledEvent(obj: any): obj is ScheduledEvent {
  return obj.foo !== undefined;
}

function isSqsEvent(obj: any): obj is SQSEvent {
  return obj.Records !== undefined;
}

interface getEnvParamsInt {
  region: string;
  AWS: any;
  keys: Array<string>;
}

export const getSSMParams = async ({
  region,
  AWS,
  keys,
}: getEnvParamsInt): Promise<any> => {
  const ssm = new AWS.SSM({ apiVersion: '2014-11-06', region });

  interface optionsInt {
    Names: Array<string>;
    WithDecryption: boolean;
  }
  const options: optionsInt = {
    Names: [],
    WithDecryption: true,
  };

  keys.forEach((key: string) => {
    options.Names.push(key);
  });

  const params = await ssm.getParameters(options).promise();
  if (
    typeof params.InvalidParameters != 'undefined' &&
    params.InvalidParameters.length > 0
  ) {
    return {};
  }
  return params.Parameters.reduce((result: any, param: any) => {
    return {
      ...result,
      [param.Name]:
        typeof param.Value !== 'undefined' ? JSON.parse(param.Value) : '',
    };
  }, {});
};

const storeToRedis = async (options: SettledOptions, value: JSON, key = '') => {
  try {
    const { skynetRespPayloadRedisConfig } = await getSSMParams({
      region: options.region,
      AWS: options.AWS,
      keys: ['skynetRespPayloadRedisConfig'],
    });
    let cacheKey = key;
    if (key === '') {
      cacheKey = `skynet-resp-${uuid()}`;
    }
    const client = redis.createClient({
      url: `redis://${skynetRespPayloadRedisConfig.elasticacheUrl}:${skynetRespPayloadRedisConfig.elasticachePort}`,
    });
    await client.connect();
    await client.set(cacheKey, JSON.stringify(value), { EX: 1800000 });
    client.quit();
    return cacheKey;
  } catch (ex: any) {
    console.log(
      `Skynet core - error writing large payload to redis - ${ex.toString()}`
    );
    throw ex;
  }
};

const withMessageProcessing = (
  opt: Options
): middy.MiddlewareObj<RawEvent, [HandledSkynetMessage]> => {
  const middlewareName = 'withMessageProcessing';
  const options = { ...defaults, ...opt } as SettledOptions;

  const sqsBefore: middy.MiddlewareFn<
    RawEvent,
    [HandledSkynetMessage]
  > = async (request): Promise<void> => {
    if (options.debugMode) {
      console.log('before', middlewareName);
      console.log('TRIGGER EVENT:', request.event);
    }
    if (isScheduledEvent(request.event) && options.isBulk) {
      await handleBulk(request, options);
    } else if (isSqsEvent(request.event)) {
      await handleSingle(request);
    } else {
      throw 'Bulk operations must be Scheduled Event Lambda Invocations, Single Operations must be SNS Event Lambda Invocations';
    }
  };

  const sqsAfter: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> = async (
    request
  ): Promise<void> => {
    if (options.debugMode) {
      console.log('after', middlewareName);
    }
    const { AWS, region, account, service } = options;

    const handledMessages = request.response;
    if (handledMessages) {
      console.log(handledMessages.length, 'message(s) were processed');
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
              rcptHandle
            );
          }

          if (workerResp.status && workerResp.status === 'fail') {
            sendToDlq(message, options, workerResp.error);
          }

          let respInRedis = false;
          let respPayloadCacheId = '';
          // Check if the length of the response is more than 256 KB. If it is, push the response
          // to Redis and send the cacheId in the response.
          if (Buffer.byteLength(workerResp.res, 'utf-8') > 250000) {
            respInRedis = false;
            // Connect to redis, create a uuid, push resp to redis, return the uuid - skynet-resp-<uuid>
            respPayloadCacheId = await storeToRedis(options, workerResp.res);
          }
          // Publish the response SNS event
          await es.publish(
            AWS,
            `arn:aws:sns:${region}:${account}:event-bus`,
            {
              ...msgBody,
              inputPayload: msgBody.payload,
              payload:
                respInRedis === false ? workerResp.res : { respPayloadCacheId },
            },
            {
              ...msgAttribs,
              status: getCompleteStatus(message),
              eventId: uuid(),
              emitter: service,
            }
          );
        })
      );
    }
  };

  const onError: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> = async (
    request
  ): Promise<void> => {
    if (request.response && request.response.length) {
      const handledMessages = request.response;
      await Promise.all(
        handledMessages.map(async (m) => {
          await sendToDlq(m, options, request.error);
        })
      );
    }
  };

  return {
    before: sqsBefore,
    after: sqsAfter,
    onError,
  };
};

export default withMessageProcessing;
