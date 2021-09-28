import { getInternal } from '@middy/util';
import middy from '@middy/core';
import { SQSEvent } from 'aws-lambda';
import _get from 'lodash/get';
import { addToEventContext, HandledSkynetMessage, Options, SkynetMessage } from './sharedTypes';
import { itemExists } from '../library/util';
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from '../library/dynamo';

/**
 * Get the current account data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} accountId is the accountId for which the data needs to be fetched
 */
const getCurrentAccountData = async (AWS: any, accountId: string) => {
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
const getCurrentUserData = async (AWS: any, userId: string) => {
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

const getAccountServiceData = async (accData: any, service?: string) => {
  let serviceAccountData = {};

  if (itemExists(accData, 'vendorData') && itemExists(accData.vendorData, `${service}`)) {
    serviceAccountData = accData.vendorData[`${service}`];
  }
  return serviceAccountData;
};

const getUserServiceData = async (userData: any, service?: string) => {
  let serviceUserData = {};

  if (itemExists(userData, 'vendorData') && itemExists(userData.vendorData, `${service}`)) {
    serviceUserData = userData.vendorData[`${service}`];
  }
  return serviceUserData;
};

const defaults = {
  service: '',
};

const createWithServiceDataStore = (opts = {}) => {
  const middlewareName = 'withServiceData';
  const options = { ...defaults, ...opts } as Options;
  const serviceDataBefore: middy.MiddlewareFn<SQSEvent, any> = async (request): Promise<void> => {
    Promise.all(
      request.response.map(async (m: SkynetMessage) => {
        const userId: string = _get(m, ['msgBody', 'context', 'user', 'userId'], '');
        const accountId: string = _get(m, ['msgBody', 'context', 'user', 'userId'], '');

        const context = await getInternal([`user-${userId}`, `account-${accountId}`], request);

        addToEventContext(request, m, middlewareName, {
          serviceUserData: getUserServiceData(context[`user-${userId}`], options.service),
          serviceAccountData: getAccountServiceData(context[`account-${accountId}`], options.service),
        });
      }),
    );
    // fetch serviceAccountData
  };

  const serviceDataAfter: middy.MiddlewareFn<SQSEvent, any> = async (request): Promise<void> => {
    const { AWS, service } = options;
    // set changes to serviceUserData/serviceAccountData
    Promise.all(
      request.response.map(async (m: HandledSkynetMessage) => {
        const userId: string = _get(m, ['msgBody', 'context', 'user', 'userId'], '');
        const accountId: string = _get(m, ['msgBody', 'context', 'user', 'userId'], '');

        const { msgBody, workerResp } = m;
        if (itemExists(workerResp, 'serviceAccountData')) {
          if (typeof workerResp.serviceAccountData !== 'object') {
            throw new Error('Service specific user account data should be an object');
          }
          if (accountId) {
            const currAccData = await getCurrentAccountData(AWS, accountId);
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
          if (userId) {
            const currUserData = await getCurrentUserData(AWS, userId);
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
      }),
    );
  };

  return {
    before: serviceDataBefore,
    after: serviceDataAfter,
  };
};

export default createWithServiceDataStore;
