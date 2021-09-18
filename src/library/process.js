import { v4 as uuid } from 'uuid';

import {
  neverThrowError,
  itemExists,
  transformMadsToReadFormat,
  evaluateMadsReadAccess,
  findDuplicateMadsKeys,
  filterMadsByReadAccess,
} from './util';
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

const getInternalAccountMads = async (AWS, accountId) => {
  const fetchResponse = await fetchRecordsByQuery(AWS, {
    TableName: 'internal-account-mads',
    ExpressionAttributeNames: { '#pk': 'accountId' },
    KeyConditionExpression: '#pk = :accId',
    ExpressionAttributeValues: {
      ':accId': { S: accountId },
    },
  });
  return fetchResponse[0];
};

const getInternalUserMads = async (AWS, userId) => {
  const fetchResponse = await fetchRecordsByQuery(AWS, {
    TableName: 'internal-user-mads',
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
      ':serv': { S: service },
    },
  });

  let accData;
  let userData;
  let internalAccountMads;
  let internalUserMads;
  if (
    itemExists(msgBody, 'context') &&
    itemExists(msgBody.context, 'user') &&
    itemExists(msgBody.context.user, 'userId') &&
    itemExists(msgBody.context.user, 'accountId')
  ) {
    // * all account and user fetch requests
    const [accDataRes, userDataRes, internalAccountMadsRes, internalUserMadsRes] = await Promise.all([
      getCurrentAccountData(AWS, msgBody.context.user.accountId),
      getCurrentUserData(AWS, msgBody.context.user.userId),
      getInternalAccountMads(AWS, msgBody.context.user.accountId),
      getInternalUserMads(AWS, msgBody.context.user.userId),
    ]);

    console.log('All fetch request responses: ', accData, userDataRes, internalAccountMadsRes, internalUserMadsRes);
    console.log(msgBody.context.user);

    accData = accDataRes || {};
    userData = userDataRes || {};
    internalAccountMads = internalAccountMadsRes || {};
    internalUserMads = internalUserMadsRes || {};
  }

  let serviceAccountData = {};
  if (itemExists(msgBody, 'context')) {
    if (itemExists(accData, 'vendorData') && itemExists(accData.vendorData, service)) {
      serviceAccountData = accData.vendorData[service];
    }
    if (!itemExists(msgBody.context, 'account')) {
      msgBody.context.account = accData;
    }
  }

  let serviceUserData = {};
  if (itemExists(msgBody, 'context')) {
    if (itemExists(userData, 'vendorData') && itemExists(userData.vendorData, service)) {
      serviceUserData = userData.vendorData[service];
    }
  }

  let globalMicroAppData = {};
  let internalMicroAppData = {};

  // * Map internal, and global MADS to the Micro Application worker arguments
  if (itemExists(msgBody, 'context')) {
    // * If for some reason account is not passed in the context,
    // * hydrate it, on the context, here
    if (!itemExists(msgBody.context, 'account')) {
      msgBody.context.account = accData;
    }

    // * Evaluate and transform global Account MADS
    if (itemExists(accData, 'globalMicroAppData')) {
      globalMicroAppData.account = transformMadsToReadFormat(
        evaluateMadsReadAccess(accData.globalMicroAppData, service),
      );
    }

    // * Evaluate and transform global User MADS
    if (itemExists(userData, 'globalMicroAppData')) {
      globalMicroAppData.user = transformMadsToReadFormat(evaluateMadsReadAccess(userData.globalMicroAppData, service));
    }

    // * No need to evaluate internal MADS because they are
    // * only for the internal Micro Application
    // * Transform internal User MADS
    if (itemExists(internalUserMads, service)) {
      internalMicroAppData.user = transformMadsToReadFormat(internalUserMads[service]);
    }

    // * Transform internal Account MADS
    if (itemExists(internalAccountMads, service)) {
      internalMicroAppData.account = transformMadsToReadFormat(internalAccountMads[service]);
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
      serviceUserData,
      globalMicroAppData,
      internalMicroAppData,
      attributes: msgAttribs,
    },
    msgHandler,
  );
  console.log(`processMessage: INFO: Result from worker is ${JSON.stringify(procRes, null, 4)}`);

  if (itemExists(procRes.workerResp, 'serviceAccountData')) {
    if (typeof procRes.workerResp.serviceAccountData !== 'object') {
      throw new Error('Service specific user account data should be an object');
    }
    console.log('Deprecation warning: serviceAccountData is being deprecated soon, please use microAppData instead.');
    console.log('See docs for more info: https://bit.ly/3kdY2w9');
    if (!itemExists(accData, 'vendorData')) {
      accData.vendorData = {};
    }
    if (!itemExists(accData.vendorData, service)) {
      accData.vendorData[service] = {};
    }
    accData.vendorData[service] = {
      ...accData.vendorData[service],
      ...procRes.workerResp.serviceAccountData,
    };
    await batchPutIntoDynamoDb(AWS, [accData], 'Account');
  }

  if (itemExists(procRes.workerResp, 'serviceUserData')) {
    if (typeof procRes.workerResp.serviceUserData !== 'object') {
      throw new Error('Service specific user data should be an object');
    }
    console.log('Deprecation warning: serviceUserData is being deprecated soon, please use microAppData instead.');
    console.log('See docs for more info: https://bit.ly/3kdY2w9');
    if (!itemExists(userData, 'vendorData')) {
      userData.vendorData = {};
    }
    if (!itemExists(userData.vendorData, service)) {
      userData.vendorData[service] = {};
    }
    userData.vendorData[service] = {
      ...userData.vendorData[service],
      ...procRes.workerResp.serviceUserData,
    };
    await batchPutIntoDynamoDb(AWS, [userData], 'User');
  }

  // * Set defaults if any internal or global MADS do not exist
  if (!itemExists(userData, 'globalMicroAppData')) {
    userData.globalMicroAppData = {};
  }

  if (!itemExists(accData, 'globalMicroAppData')) {
    accData.globalMicroAppData = {};
  }

  if (!itemExists(userData.globalMicroAppData, service)) {
    userData.globalMicroAppData[service] = [];
  }

  if (!itemExists(accData.globalMicroAppData, service)) {
    accData.globalMicroAppData[service] = [];
  }

  if (!itemExists(internalUserMads, service)) {
    internalUserMads[service] = [];
  }

  if (!itemExists(internalAccountMads, service)) {
    internalAccountMads[service] = [];
  }

  // * Validate any changes to the global and internal
  // * user MADS from the process worker response, then overwrite any changes
  if (itemExists(procRes.workerResp, 'microAppData') && itemExists(procRes.workerResp.microAppData.user)) {
    const { user: userMads } = procRes.workerResp.microAppData;

    // * Validation
    if (!Array.isArray(userMads)) {
      throw new Error('Worker response in user microAppData must be of type Array.');
    }

    userMads.forEach((item) => {
      if (!itemExists(item, 'key') || !itemExists(item, 'value') || !itemExists(item, 'readAccess')) {
        throw new Error('Missing a required key (key, value, or readAccess) in a user microAppData item.');
      }
    });

    const duplicateKey = findDuplicateMadsKeys(userMads);

    if (duplicateKey) {
      throw new Error(
        `Key: ${duplicateKey} in user microAppData array is not unique. All keys in the microAppData arrays must be unique.`,
      );
    }

    // * Overwrite current MADS with the process worker response MADS
    const [internalMads, globalMads] = filterMadsByReadAccess(userMads);

    userData.globalMicroAppData[service] = globalMads;
    internalUserMads[service] = internalMads;

    await batchPutIntoDynamoDb(AWS, [userData], 'User');
    await batchPutIntoDynamoDb(AWS, [internalUserMads], 'internal-user-mads');
  }

  // * Validate any changes to the global and internal
  // * account MADS from the process worker response, then overwrite any changes
  if (itemExists(procRes.workerResp, 'microAppData') && itemExists(procRes.workerResp.microAppData.account)) {
    const { account: accountMads } = procRes.workerResp.microAppData;

    // * Validation
    if (!Array.isArray(accountMads)) {
      throw new Error('Worker response in account microAppData must be of type Array.');
    }

    accountMads.forEach((item) => {
      if (!itemExists(item, 'key') || !itemExists(item, 'value') || !itemExists(item, 'readAccess')) {
        throw new Error('Missing a required key (key, value, or readAccess) in a account microAppData item.');
      }
    });

    const duplicateKey = findDuplicateMadsKeys(accountMads);

    if (duplicateKey) {
      throw new Error(
        `Key: ${duplicateKey} in account microAppData array is not unique. All keys in the microAppData arrays must be unique.`,
      );
    }

    // * Overwrite current MADS with the process worker response MADS
    const [internalMads, globalMads] = filterMadsByReadAccess(accountMads);

    console.log('internal mads: ', internalMads);
    console.log('global mads: ', globalMads);

    accData.globalMicroAppData[service] = globalMads;
    internalAccountMads[service] = internalMads;

    await batchPutIntoDynamoDb(AWS, [accData], 'Account');
    await batchPutIntoDynamoDb(AWS, [internalAccountMads], 'internal-account-mads');
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
