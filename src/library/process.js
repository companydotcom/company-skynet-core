import uuid from 'uuid/v4';

import { neverThrowError } from './util';
import { fetchRecordsByQuery } from './dynamo';
import es from './eventStream';
import {
  deleteMsg as deleteMsgFromQueue,
  sendMsg as sendSqsMsg,
} from './queue';
import { isArray } from 'util';

/**
 * This function processes the message that is sent to it by invoking the message handler function that is passed to it as a param
 * @param {Object} param0 is the message object containing properties msgBody (Body of the SNS message), msgAttribs (Message attributes of the SNS message) and rcptHandle (Message receipt handle for the message from SQS)
 * @param {Function} msgHandler is the handler function that will proess the message
 * @returns {Boolean}
 * @throws {Error}
 */
export const processMessage = async (AWS, region, service, account, 
  { msgBody, msgAttribs, rcptHandle }, msgHandler) => {
  // Use the neverThrowError function from utils to process the message making
  // sure that no error is thrown back

  const dbConfig = await fetchRecordsByQuery(
    AWS,
    {
      TableName: 'vendorConfig',
      ExpressionAttributeNames: { '#pk': 'service' },
      KeyConditionExpression: '#pk = :serv',
      ExpressionAttributeValues: {
        ':serv': { S: `${service}` },
      },
    }
  );

  const procRes = await neverThrowError({
    message: msgBody,
    serviceConfigData: typeof dbConfig !== 'undefined'
      && isArray(dbConfig) && dbConfig.length > 0
      && typeof dbConfig[0].data !== 'undefined'
      ? dbConfig[0].data : [],
    attributes: msgAttribs,
  }, msgHandler);
  console.log(`bulkTransition: processMessage: INFO: Result from worker is ${JSON.stringify(procRes, null, 4)}`);

  // Publish the response SNS event
  await es.publish(
    AWS,
    `arn:aws:sns:${region}:${account}:event-bus`,
    {
      ...msgBody,
      payload: {
        ...msgBody.payload,
        ...procRes.processResp,
      },
    },
    {
      ...msgAttribs,
      status: procRes.status,
      eventId: uuid(),
      emitter: service,
    },
  );

  // Delete the message from the queue using the rcptHandle, if available.
  if (typeof rcptHandle !== 'undefined') {
    await deleteMsgFromQueue(
      AWS, 
      region,
      `https://sqs.${region}.amazonaws.com/${account}/${service}-bulktq`,
      rcptHandle,
    );
  }

  // If the status of the process response is 'fail', send the message to Lambda
  // DLQ
  if (procRes.status === 'fail') {
    sendSqsMsg(
      AWS,
      region,
      `https://sqs.${region}.amazonaws.com/${account}/${service}-ldlq`,
      JSON.stringify({
        failedIn: service,
        body: {
          Message: msgBody,
          MessageAttributes: msgAttribs,
          Error: procRes.error,
        },
      }),
    );
  }
  return true;
};