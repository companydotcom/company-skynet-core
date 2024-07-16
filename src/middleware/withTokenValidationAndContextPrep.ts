import middy from '@middy/core';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  userId: string;
  exp: number;
  [key: string]: any; // To handle any additional fields in the token
}

interface DecodedResult {
  userId?: string;
  error?: string;
}

import {
  HandledSkynetMessage,
  SkynetMessage,
  Options,
} from '../library/sharedTypes';
import { fetchRecordsByQuery } from '../library/dynamo';
import { getMiddyInternal } from '../library/util';

const defaults = {
  region: 'us-east-1',
};

/**
 * Get the current account data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} accountId is the accountId for which the data needs to be fetched
 */
const getCurrentAccountData = async (AWS: any, accountId: string, options: Options) => {
  if (accountId === '' || typeof accountId === 'undefined') {
    return undefined;
  }
  const fetchResponse: any = await fetchRecordsByQuery(AWS, options, {
    TableName: 'Account',
    ExpressionAttributeNames: { '#pk': 'accountId' },
    KeyConditionExpression: '#pk = :accId',
    ExpressionAttributeValues: {
      ':accId': { S: accountId },
    },
  });

  if (fetchResponse.length === 0) {
    return undefined;
  }
 
  if (fetchResponse.length === 0) {
    return undefined;
  }

  if (
    typeof fetchResponse[0] !== 'undefined' &&
    typeof fetchResponse[0].globalMicroAppData !== 'undefined'
  ) {
    delete fetchResponse[0].globalMicroAppData;
  }
  return fetchResponse[0];
};

/**
 * Get the current user data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} userId is the userId for which the data needs to be fetched
 */
const getCurrentUserData = async (AWS: any, userId: string, options: Options) => {
  if (userId === '' || typeof userId === 'undefined') {
    return undefined;
  }
  const fetchResponse: any = await fetchRecordsByQuery(AWS, options, {
    TableName: 'User',
    ExpressionAttributeNames: { '#pk': 'userId' },
    KeyConditionExpression: '#pk = :uId',
    ExpressionAttributeValues: {
      ':uId': { S: userId },
    },
  });

  if (fetchResponse.length === 0) {
    return undefined;
  }

  if (fetchResponse.length === 0) {
    return undefined;
  }

  if (
    typeof fetchResponse[0] !== 'undefined' &&
    typeof fetchResponse[0].globalMicroAppData !== 'undefined'
  ) {
    delete fetchResponse[0].globalMicroAppData;
  }
  return fetchResponse[0];
};

const validateAndDecodeToken = async (token: string): Promise<DecodedResult> => {
  try {
    // Decode the token
    const decoded: DecodedToken = jwtDecode(token);

    // Check if the token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      throw new Error('Token has expired');
    }

    // Extract userId
    const userId = decoded.sub.split('auth0|')[1];
    return { userId };
  } catch (error) {
    return { error: (error as Error).message };
  }
} 


const withTokenValidationAndContextPrep = (
  opt: Options
): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const middlewareName = 'withTokenValidationAndContextPrep';
  const options = { ...defaults, ...opt };
  const before: middy.MiddlewareFn<
  [SkynetMessage],
  [HandledSkynetMessage]
  > = async (request): Promise<void> => {
    console.log('Running withTokenValidationAndContextPrep middleware - BEFORE');
    if (options.debugMode) {
      console.log('before', middlewareName);
    }
    const middeyInternal: any = await getMiddyInternal(request, ['AWS']);
    for (const m of request.event) {
      // validate token if received in the context
      let tokenData;
      if (typeof m.msgBody.context.token !== 'undefined') {
        tokenData = await validateAndDecodeToken(m.msgBody.context.token);        
      }
      const userId = m.msgBody.context.user.userId;
      if (typeof tokenData !== 'undefined' && tokenData.userId !== userId) {
        throw new Error(
          'Messages using "withTokenValidationAndContextPrep" has invalid token'
        );
      }
      if (!userId) {
        throw new Error(
          'Messages using "withTokenValidationAndContextPrep" must include a userId on the context.user object'
        );
      }
      const userData = await getCurrentUserData(middeyInternal.AWS, userId, options);
      let accountId = undefined;
      if (typeof userData !== 'undefined') {
        request.internal[`user-${userId}`] = userData;
        accountId = request.internal[`user-${userId}`].accountId;
        const accountData = await getCurrentAccountData(middeyInternal.AWS, accountId, options);
        if (typeof accountData !== 'undefined') {
          request.internal[`account-${accountId}`] = accountData;
        }
      }
      console.log(
        `Fetching latest User: ${userId} and Account: ${accountId} for this message`
      );
    }
  };

  return {
    before,
  };
};

export default withTokenValidationAndContextPrep;
