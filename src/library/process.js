import uuid from 'uuid/v4';
import { isArray } from 'util';

import { neverThrowError, itemExists } from './util';
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from './dynamo';
import es from './eventStream';
import {
  deleteMsg as deleteMsgFromQueue,
  sendMsg as sendSqsMsg,
} from './queue';

/**
 * This function processes the message that is sent to it by invoking the message handler function that is passed to it as a param
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} region is the region of AWS that this service is running in
 * @param {string} service is the name of the service
 * @param { string } account is AWS the account number
 * @param { msgBody: object, msgAttribs: object, rcptHandle: string } is the message object containing properties msgBody (Body of the SNS message), msgAttribs (Message attributes of the SNS message) and rcptHandle (Message receipt handle for the message from SQS)
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
    },
  );

  // eslint-disable-next-line no-undef-init
  let serviceUserData = undefined;
  if (itemExists(msgBody, 'context')
      && itemExists(msgBody.context, 'user')
      && itemExists(msgBody.context.user, 'accountId')) {
    const accData = await fetchRecordsByQuery(
      AWS,
      {
        TableName: 'Account',
        ExpressionAttributeNames: { '#pk': 'accountId' },
        KeyConditionExpression: '#pk = :accId',
        ExpressionAttributeValues: {
          ':accId': { S: msgBody.context.user.accountId },
        },
      },
    );
    if (itemExists(accData, 'vendorData')
      && itemExists(accData.vendorData, `${service}`)) {
      serviceUserData = accData.vendorData[`${service}`];
    }
  }

  const procRes = await neverThrowError({
    message: msgBody,
    serviceConfigData: typeof dbConfig !== 'undefined'
      && isArray(dbConfig) && dbConfig.length > 0
      && typeof dbConfig[0].configdata !== 'undefined'
      ? dbConfig[0].configdata : [],
    serviceUserData,
    attributes: msgAttribs,
  }, msgHandler);
  console.log(`bulkTransition: processMessage: INFO: Result from worker is ${JSON.stringify(procRes, null, 4)}`);

  if (itemExists(procRes, 'serviceUserData')) {
    if (typeof procRes.serviceUserData !== 'object') {
      throw new Error('Service specific user data should be an object');
    }
    if (itemExists(msgBody, 'context')
      && itemExists(msgBody.context, 'user')
      && itemExists(msgBody.context.user, 'accountId')) {
      const currAccData = await fetchRecordsByQuery(
        AWS,
        {
          TableName: 'Account',
          ExpressionAttributeNames: { '#pk': 'accountId' },
          KeyConditionExpression: '#pk = :accId',
          ExpressionAttributeValues: {
            ':accId': { S: msgBody.context.user.accountId },
          },
        },
      );
      if (!itemExists(currAccData, 'vendorData')) {
        currAccData.vendorData = {};
      }
      if (!itemExists(currAccData.vendorData, `${service}`)) {
        currAccData.vendorData[`${service}`] = {};
      }
      currAccData.vendorData[`${service}`] = {
        ...currAccData.vendorData[`${service}`],
        ...procRes.serviceUserData,
      };
      await batchPutIntoDynamoDb(AWS, [currAccData], 'Account');
    }
  }

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
