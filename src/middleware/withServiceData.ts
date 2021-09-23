import { itemExists } from '../library/util';
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from '../library/dynamo';
import { getInternal } from '@middy/util';

/**
 * Get the current account data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} accountId is the accountId for which the data needs to be fetched
 */
 const getCurrentAccountData = async (AWS, accountId) => {
  const fetchResponse = await fetchRecordsByQuery(
    AWS,
    {
      TableName: 'Account',
      ExpressionAttributeNames: { '#pk': 'accountId' },
      KeyConditionExpression: '#pk = :accId',
      ExpressionAttributeValues: {
        ':accId': { S: accountId },
      },
    },
  );
  return fetchResponse[0];
};

/**
 * Get the current user data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} userId is the userId for which the data needs to be fetched
 */
const getCurrentUserData = async (AWS, userId) => {
  const fetchResponse = await fetchRecordsByQuery(
    AWS,
    {
      TableName: 'User',
      ExpressionAttributeNames: { '#pk': 'userId' },
      KeyConditionExpression: '#pk = :uId',
      ExpressionAttributeValues: {
        ':uId': { S: userId },
      },
    },
  );
  return fetchResponse[0];
};

const getAccountServiceData = async ({ AWS, service }, msgBody) => {
  // eslint-disable-next-line no-undef-init
  let serviceAccountData = {};
  if (itemExists(msgBody, 'context')
    && itemExists(msgBody.context, 'user')
    && itemExists(msgBody.context.user, 'accountId')) {
    const accData = await getCurrentAccountData(
      AWS, msgBody.context.user.accountId,
    );
    if (itemExists(accData, 'vendorData')
      && itemExists(accData.vendorData, `${service}`)) {
      serviceAccountData = accData.vendorData[`${service}`];
    }
    if (!itemExists(msgBody.context, 'account')) {
      msgBody.context.account = accData;
    }
  }
  return serviceAccountData;
}

const getUserServiceData = async ({ AWS, service }, msgBody) => {
  // eslint-disable-next-line no-undef-init
  let serviceUserData = {};
  if (itemExists(msgBody, 'context')
    && itemExists(msgBody.context, 'user')
    && itemExists(msgBody.context.user, 'userId')) {
    const userData = await getCurrentUserData(
      AWS, msgBody.context.user.userId,
    );
    if (itemExists(userData, 'vendorData')
      && itemExists(userData.vendorData, `${service}`)) {
      serviceUserData = userData.vendorData[`${service}`];
    }
  }
  return serviceUserData;
}

const defaults = {};

const createWithServiceDataStore = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const serviceDataBefore = async request => {
    // fetch vendorConfig
    // For now on userContext, but if these move to SSM/Parameter store
    // fetch serviceUserData
    const data = await getInternal('messagesToProcess', request);
    request.internal.messagesToProcess = data.messagesToProcess.map((m) => {
      m.serviceUserData = getUserServiceData(options, m.msgBody);
      m.serviceAccountData = getAccountServiceData(options, m.msgBody);
    })
    // fetch serviceAccountData
  };

  const serviceDataAfter = async request => {
    const { AWS, service } = options;
    const data = await getInternal('messagesToProcess', request);
    // set changes to serviceUserData/serviceAccountData
    Promise.all(data.messagesToProcess.map(async m => {
      const { msgBody, workerResp } = m;
      if (itemExists(workerResp, 'serviceAccountData')) {
        if (typeof workerResp.serviceAccountData !== 'object') {
          throw new Error('Service specific user account data should be an object');
        }
        if (itemExists(msgBody, 'context')
          && itemExists(msgBody.context, 'user')
          && itemExists(msgBody.context.user, 'accountId')) {
          const currAccData = await getCurrentAccountData(
            AWS, msgBody.context.user.accountId,
          );
          if (!itemExists(currAccData, 'vendorData')) {
            currAccData.vendorData = {};
          }
          if (!itemExists(currAccData.vendorData, `${service}`)) {
            currAccData.vendorData[`${service}`] = {};
          }
          currAccData.vendorData[`${service}`] = {
            ...currAccData.vendorData[`${service}`],
            ...workerResp.serviceAccountData,
          };
          await batchPutIntoDynamoDb(AWS, [currAccData], 'Account');
        }
      }

      if (itemExists(workerResp, 'serviceUserData')) {
        if (typeof workerResp.serviceUserData !== 'object') {
          throw new Error('Service specific user data should be an object');
        }
        if (itemExists(msgBody, 'context')
          && itemExists(msgBody.context, 'user')
          && itemExists(msgBody.context.user, 'userId')) {
          const currUserData = await getCurrentUserData(
            AWS, msgBody.context.user.userId,
          );
          if (!itemExists(currUserData, 'vendorData')) {
            currUserData.vendorData = {};
          }
          if (!itemExists(currUserData.vendorData, `${service}`)) {
            currUserData.vendorData[`${service}`] = {};
          }
          currUserData.vendorData[`${service}`] = {
            ...currUserData.vendorData[`${service}`],
            ...workerResp.serviceUserData,
          };
          await batchPutIntoDynamoDb(AWS, [currUserData], 'User');
        }
      }
    }));
  };

  return {
    before: serviceDataBefore,
    after: serviceDataAfter,
  };
};

export default createWithServiceDataStore;
