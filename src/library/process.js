import { v4 as uuid } from 'uuid';

import { neverThrowError, itemExists, evaluateSharedMicroApplicationData } from './util';
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from './dynamo';
import es from './eventStream';
import { deleteMsg as deleteMsgFromQueue, sendMsg as sendSqsMsg } from './queue';

/**
 * Get the current account data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} accountId is the accountId for which the data needs to be fetched
 */
const getCurrentAccountData = async (AWS, accountId) => {
  const fetchResponse = await fetchRecordsByQuery(AWS, {
    TableName: 'Account',
    ExpressionAttributeNames: { '#pk': 'accountId' },
    KeyConditionExpression: '#pk = :accId',
    ExpressionAttributeValues: {
      ':accId': { S: accountId },
    },
  });
  return fetchResponse[0];
};

/**
 * Get the current user data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} userId is the userId for which the data needs to be fetched
 */
const getCurrentUserData = async (AWS, userId) => {
  const fetchResponse = await fetchRecordsByQuery(AWS, {
    TableName: 'User',
    ExpressionAttributeNames: { '#pk': 'userId' },
    KeyConditionExpression: '#pk = :uId',
    ExpressionAttributeValues: {
      ':uId': { S: userId },
    },
  });
  return fetchResponse[0];
};

/**
 * This function processes the message that is sent to it by invoking the message handler function that is passed to it as a param
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} region is the region of AWS that this service is running in
 * @param {string} service is the name of the service
 * @param { string } account is AWS the account number
 * @param { msgBody: object, msgAttribs: object, rcptHandle: string } is the message object containing properties msgBody (Body of the SNS message), msgAttribs (Message attributes of the SNS message) and rcptHandle (Message receipt handle for the message from SQS)
 * @param {Function} msgHandler is the handler function that will process the message
 * @returns {Boolean}
 * @throws {Error}
 */
export const processMessage = async (
  AWS,
  region,
  service,
  account,
  { msgBody, msgAttribs, rcptHandle },
  msgHandler,
) => {
  // Use the neverThrowError function from utils to process the message making
  // sure that no error is thrown back

  const dbConfig = await fetchRecordsByQuery(AWS, {
    TableName: 'vendorConfig',
    ExpressionAttributeNames: { '#pk': 'service' },
    KeyConditionExpression: '#pk = :serv',
    ExpressionAttributeValues: {
      ':serv': { S: `${service}` },
    },
  });

  // eslint-disable-next-line no-undef-init
  let serviceAccountData = {};
  if (
    itemExists(msgBody, 'context') &&
    itemExists(msgBody.context, 'user') &&
    itemExists(msgBody.context.user, 'accountId')
  ) {
    const accData = await getCurrentAccountData(AWS, msgBody.context.user.accountId);
    if (itemExists(accData, 'vendorData') && itemExists(accData.vendorData, `${service}`)) {
      serviceAccountData = accData.vendorData[`${service}`];
    }
    if (!itemExists(msgBody.context, account)) {
      msgBody.context.account = accData;
    }
  }

  // eslint-disable-next-line
  let sharedMicroApplicationAccountData = {};
  if (
    itemExists(msgBody, 'context') &&
    itemExists(msgBody.context, 'user') &&
    itemExists(msgBody.context.user, 'accountId')
  ) {
    const accData = await getCurrentAccountData(AWS, msgBody.context.user.accountId);
    if (itemExists(accData, 'sharedMicroApplicationAccountData')) {
      sharedMicroApplicationAccountData = evaluateSharedMicroApplicationData(
        accData.sharedMicroApplicationAccountData,
        service,
      );
    }
    if (!itemExists(msgBody.context, account)) {
      // eslint-disable-next-line
      msgBody.context.account = accData;
    }
  }

  // eslint-disable-next-line no-undef-init
  let serviceUserData = {};
  if (
    itemExists(msgBody, 'context') &&
    itemExists(msgBody.context, 'user') &&
    itemExists(msgBody.context.user, 'userId')
  ) {
    const userData = await getCurrentUserData(AWS, msgBody.context.user.userId);
    if (itemExists(userData, 'vendorData') && itemExists(userData.vendorData, `${service}`)) {
      serviceUserData = userData.vendorData[`${service}`];
    }
  }

  // eslint-disable-next-line
  let sharedMicroApplicationUserData = {};
  if (
    itemExists(msgBody, 'context') &&
    itemExists(msgBody.context, 'user') &&
    itemExists(msgBody.context.user, 'userId')
  ) {
    const userData = await getCurrentUserData(AWS, msgBody.context.user.userId);
    if (itemExists(userData, 'sharedMicroApplicationUserData')) {
      sharedMicroApplicationUserData = evaluateSharedMicroApplicationData(
        userData.sharedMicroApplicationUserData,
        service,
      );
    }
  }

  const procRes = await neverThrowError(
    {
      message: msgBody,
      serviceConfigData:
        typeof dbConfig !== 'undefined' &&
        Array.isArray(dbConfig) &&
        dbConfig.length > 0 &&
        typeof dbConfig[0].configdata !== 'undefined'
          ? dbConfig[0].configdata
          : [],
      serviceAccountData,
      sharedMicroApplicationAccountData,
      serviceUserData,
      sharedMicroApplicationUserData,
      attributes: msgAttribs,
    },
    msgHandler,
  );
  console.log(`processMessage: INFO: Result from worker is ${JSON.stringify(procRes, null, 4)}`);

  if (itemExists(procRes.workerResp, 'serviceAccountData')) {
    if (typeof procRes.workerResp.serviceAccountData !== 'object') {
      throw new Error('Service specific user account data should be an object');
    }
    if (
      itemExists(msgBody, 'context') &&
      itemExists(msgBody.context, 'user') &&
      itemExists(msgBody.context.user, 'accountId')
    ) {
      const currAccData = await getCurrentAccountData(AWS, msgBody.context.user.accountId);
      if (!itemExists(currAccData, 'vendorData')) {
        currAccData.vendorData = {};
      }
      if (!itemExists(currAccData.vendorData, `${service}`)) {
        currAccData.vendorData[`${service}`] = {};
      }
      currAccData.vendorData[`${service}`] = {
        ...currAccData.vendorData[`${service}`],
        ...procRes.workerResp.serviceAccountData,
      };
      await batchPutIntoDynamoDb(AWS, [currAccData], 'Account');
    }
  }

  if (itemExists(procRes.workerResp, 'sharedMicroApplicationAccountData')) {
    if (typeof procRes.workerResp.sharedMicroApplicationAccountData !== 'object') {
      throw new Error('Shared service account data should be an object');
    }
    if (
      itemExists(msgBody, 'context') &&
      itemExists(msgBody.context, 'user') &&
      itemExists(msgBody.context.user, 'accountId')
    ) {
      const currAccData = await getCurrentAccountData(AWS, msgBody.context.user.accountId);
      if (!itemExists(currAccData, 'sharedMicroApplicationAccountData')) {
        currAccData.sharedMicroApplicationAccountData = {};
      }
      if (!itemExists(currAccData.sharedMicroApplicationAccountData, `${service}`)) {
        currAccData.sharedMicroApplicationAccountData[`${service}`] = {
          microApplicationsToShareWith: [],
          serviceData: {},
        };
      }
      currAccData.sharedMicroApplicationAccountData[`${service}`] = {
        ...currAccData.sharedMicroApplicationAccountData[`${service}`],
        ...procRes.workerResp.sharedMicroApplicationAccountData,
      };
      await batchPutIntoDynamoDb(AWS, [currAccData], 'Account');
    }
  }

  if (itemExists(procRes.workerResp, 'serviceUserData')) {
    if (typeof procRes.workerResp.serviceUserData !== 'object') {
      throw new Error('Service specific user data should be an object');
    }
    if (
      itemExists(msgBody, 'context') &&
      itemExists(msgBody.context, 'user') &&
      itemExists(msgBody.context.user, 'userId')
    ) {
      const currUserData = await getCurrentUserData(AWS, msgBody.context.user.userId);
      if (!itemExists(currUserData, 'vendorData')) {
        currUserData.vendorData = {};
      }
      if (!itemExists(currUserData.vendorData, `${service}`)) {
        currUserData.vendorData[`${service}`] = {};
      }
      currUserData.vendorData[`${service}`] = {
        ...currUserData.vendorData[`${service}`],
        ...procRes.workerResp.serviceUserData,
      };
      await batchPutIntoDynamoDb(AWS, [currUserData], 'User');
    }
  }

  if (itemExists(procRes.workerResp, 'sharedMicroApplicationUserData')) {
    if (typeof procRes.workerResp.sharedMicroApplicationUserData !== 'object') {
      throw new Error('Shared service user data should be an object');
    }
    if (
      itemExists(msgBody, 'context') &&
      itemExists(msgBody.context, 'user') &&
      itemExists(msgBody.context.user, 'userId')
    ) {
      const currUserData = await getCurrentUserData(AWS, msgBody.context.user.userId);
      if (!itemExists(currUserData, 'sharedMicroApplicationUserData')) {
        currUserData.sharedMicroApplicationUserData = {};
      }
      if (!itemExists(currUserData.sharedMicroApplicationUserData, `${service}`)) {
        currUserData.sharedMicroApplicationUserData[`${service}`] = {
          microApplicationsToShareWith: [],
          serviceData: {},
        };
      }
      currUserData.sharedMicroApplicationUserData[`${service}`] = {
        ...currUserData.sharedMicroApplicationUserData[`${service}`],
        ...procRes.workerResp.sharedMicroApplicationUserData,
      };
      await batchPutIntoDynamoDb(AWS, [currUserData], 'User');
    }
  }

  if (itemExists(procRes.workerResp, 'crmData')) {
    if (typeof procRes.workerResp.crmData !== 'object') {
      throw new Error('Data going to a CRM should be an object');
    }
    if (Object.keys(procRes.workerResp.crmData).length > 0) {
      await es.publish(
        AWS,
        `arn:aws:sns:${region}:${account}:event-bus`,
        {
          ...msgBody,
          payload: procRes.workerResp.crmData,
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

  let payload;

  if (Object.prototype.hasOwnProperty.call(procRes, 'workerResp')) {
    if (Object.prototype.hasOwnProperty.call(procRes.workerResp, 'res')) {
      payload = procRes.workerResp.res;
    } else {
      payload = procRes.workerResp;
    }
  } else {
    payload = undefined;
  }

  const getCompleteStatus = (procResult) => {
    let result = procResult.status;
    if (
      Object.prototype.hasOwnProperty.call(procResult, 'workerResp') &&
      Object.prototype.hasOwnProperty.call(procResult.workerResp, 'extraStatus')
    ) {
      result = `${result}-${procResult.workerResp.extraStatus}`;
    }
    return result;
  };

  // Publish the response SNS event
  await es.publish(
    AWS,
    `arn:aws:sns:${region}:${account}:event-bus`,
    {
      ...msgBody,
      inputPayload: msgBody.payload,
      payload,
    },
    {
      ...msgAttribs,
      status: getCompleteStatus(procRes),
      eventId: uuid(),
      emitter: service,
    },
  );

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
