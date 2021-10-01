import middy from '@middy/core';

import {
  HandledSkynetMessage,
  SkynetMessage,
  Options,
} from '../library/sharedTypes';
import { fetchRecordsByQuery } from '../library/dynamo';

const defaults = {
  region: 'us-east-1',
};

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

const createWithContextPrep = (
  opt: Options
): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const middlewareName = 'withContextPrep';
  const options = { ...defaults, ...opt };
  const before: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> =
    async (request): Promise<void> => {
      if (options.debugMode) {
        console.log('before', middlewareName);
      }
      request.event.map(async (m) => {
        const userId = m.msgBody.context.user.userId;
        const accountId = m.msgBody.context.user.accountId;
        if (!userId || !accountId) {
          throw new Error(
            'Messages using "withContextPrep" must include a userId and accountId on the context.user object'
          );
        }
        request.internal[`user-${userId}`] = getCurrentUserData(
          options.AWS,
          userId
        );
        const account = getCurrentAccountData(options.AWS, accountId);
        request.internal[`account-${accountId}`] = account;
        m.msgBody.context.user.account = account;
        console.log(
          `Fetching latest User: ${userId} and Account: ${accountId} for this message`
        );
      });
    };

  return {
    before,
  };
};

export default createWithContextPrep;
