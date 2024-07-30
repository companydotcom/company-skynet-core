import middy from '@middy/core';
import _get from 'lodash/get';
import _isundefined from 'lodash/isUndefined';
import _isnull from 'lodash/isNull';
import {
  SkynetMessage,
  HandledSkynetMessage,
  Options,
} from '../library/sharedTypes';
import {
  transformMadsToReadFormat,
  evaluateMadsReadAccess,
  itemExists,
  findDuplicateMadsKeys,
  addToEventContext,
  getMiddyInternal,
} from '../library/util';
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from '../library/dynamo';

/**
 * Fetch data from DynamoDB based on provided parameters.
 * @param {any} AWS - AWS SDK instance.
 * @param {Options} options - Query options.
 * @param {string} tableName - Name of the DynamoDB table.
 * @param {string} idKey - Primary key of the table.
 * @param {string} idValue - Value of the primary key.
 * @returns {Promise<any>} - Fetched data.
 */
const fetchData = async (
  AWS: any,
  options: Options,
  tableName: string,
  idKey: string,
  idValue: string,
): Promise<any> => {
  if (!idValue) return undefined;
  const response = await fetchRecordsByQuery(AWS, options, {
    TableName: tableName,
    ExpressionAttributeNames: { '#pk': idKey },
    KeyConditionExpression: '#pk = :id',
    ExpressionAttributeValues: { ':id': { S: idValue } },
  });
  if (response[0]?.globalMicroAppData) delete response[0].globalMicroAppData;
  return response[0];
};

/**
 * Get the current user data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} userId is the userId for which the data needs to be fetched
 */
const getCurrentUserData = (AWS: any, options: Options, userId: string) =>
  fetchData(AWS, options, 'User', 'userId', userId);

/**
 * Get the current account data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} accountId is the accountId for which the data needs to be fetched
 */
const getCurrentAccountData = async (
  AWS: any,
  options: Options,
  accountId: string,
) => {
  if (accountId === '' || typeof accountId === 'undefined') {
    return undefined;
  }
  return fetchData(AWS, options, 'Account', 'accountId', accountId);
};

const getInternalAccountMads = async (
  AWS: any,
  options: Options,
  accountId: string,
) => {
  if (accountId === '' || typeof accountId === 'undefined') {
    return undefined;
  }
  const fetchResponse = await fetchRecordsByQuery(AWS, options, {
    TableName: 'account-mads',
    ExpressionAttributeNames: { '#pk': 'accountId' },
    KeyConditionExpression: '#pk = :accId',
    ExpressionAttributeValues: {
      ':accId': { S: accountId },
    },
  });

  return !_isundefined(fetchResponse[0]) && !_isnull(fetchResponse[0])
    ? fetchResponse[0]
    : { accountId };
};

const getInternalUserMads = async (
  AWS: any,
  options: Options,
  userId: string,
) => {
  if (userId === '' || typeof userId === 'undefined') {
    return undefined;
  }
  const fetchResponse = await fetchRecordsByQuery(AWS, options, {
    TableName: 'user-mads',
    ExpressionAttributeNames: { '#pk': 'userId' },
    KeyConditionExpression: '#pk = :uId',
    ExpressionAttributeValues: {
      ':uId': { S: userId },
    },
  });
  return !_isundefined(fetchResponse[0]) && !_isnull(fetchResponse[0])
    ? fetchResponse[0]
    : { userId };
};

const defaults = {
  service: '',
};

const createWithMads = (
  opts: Options,
): middy.MiddlewareObj<SkynetMessage[], HandledSkynetMessage[]> => {
  const options = { ...defaults, ...opts };
  const middlewareName = 'withMads';
  const internalMadsCache = {} as any;
  // const { service } = options;

  const before: middy.MiddlewareFn<
    SkynetMessage[],
    HandledSkynetMessage[]
  > = async (request): Promise<void> => {
    console.log('Running withMads middleware - BEFORE');
    if (options.debugMode) {
      console.log('before', middlewareName);
    }
    const middeyInternal: any = await getMiddyInternal(request, ['AWS']);
    const { service } = options;
    await Promise.all(
      request.event.map(async (m: SkynetMessage) => {
        const userId: any | undefined = _get(
          m,
          ['msgBody', 'context', 'user', 'userId'],
          undefined,
        );

        const accountId: any | undefined = _get(
          m,
          ['msgBody', 'context', 'user', 'accountId'],
          undefined,
        );

        const [internalAccountMads, internalUserMads] = await Promise.all([
          getInternalAccountMads(middeyInternal.AWS, options, accountId),
          getInternalUserMads(middeyInternal.AWS, options, userId),
        ]);

        Object.assign(
          internalMadsCache,
          internalUserMads
            ? {
                [userId]: internalUserMads,
              }
            : typeof userId !== 'undefined'
              ? {
                  [userId]: { userId },
                }
              : { ['undefined-userId']: {} },
        );
        Object.assign(
          internalMadsCache,
          internalAccountMads
            ? {
                [accountId]: internalAccountMads,
              }
            : typeof accountId !== 'undefined'
              ? {
                  [accountId]: { accountId },
                }
              : { ['undefined-accountId']: {} },
        );

        // * Evaluate data of user from user-mads and
        // * internal - account - mads. Put in the data owned by the
        // * service in internalMicroAppData. This data is writeable by
        // * service. Put all data shared with the application from readAccess
        // * mentioning the service or '*' into sharedMicroAppData.
        const internalMicroAppData = {
          user: {} as any,
          account: {} as any,
        };

        const sharedMicroAppData = {
          user: {} as any,
          account: {} as any,
        };

        let serviceUserMads: any = {};
        // * Evaluate and transform internal MADS
        if (typeof userId !== 'undefined') {
          serviceUserMads = transformMadsToReadFormat({
            [service]: _get(internalUserMads, service),
          });
        }

        let serviceAccountMads: any = {};
        if (typeof accountId !== 'undefined') {
          serviceAccountMads = transformMadsToReadFormat({
            [service]: _get(internalAccountMads, service),
          });
        }

        internalMicroAppData.user = !_isundefined(serviceUserMads[service])
          ? serviceUserMads[service]
          : {};

        internalMicroAppData.account = !_isundefined(
          serviceAccountMads[service],
        )
          ? serviceAccountMads[service]
          : {};

        // * Remove the service owned data from sharedMicroAppData as it is
        // * already available in internalUserMads and internalAccountMads
        if (typeof internalAccountMads !== 'undefined') {
          sharedMicroAppData.account = transformMadsToReadFormat(
            evaluateMadsReadAccess(
              Object.keys(internalAccountMads)
                .filter((key) => key !== service)
                .reduce((obj, key) => {
                  return {
                    ...obj,
                    [key]: internalAccountMads[key],
                  };
                }, {}),
              service,
            ),
          );
        }
        if (typeof internalUserMads !== 'undefined') {
          sharedMicroAppData.user = transformMadsToReadFormat(
            evaluateMadsReadAccess(
              Object.keys(internalUserMads)
                .filter((key) => key !== service)
                .reduce((obj, key) => {
                  return {
                    ...obj,
                    [key]: internalUserMads[key],
                  };
                }, {}),
              service,
            ),
          );
        }

        addToEventContext(request, m, middlewareName, {
          internalMicroAppData,
          sharedMicroAppData,
        });
      }),
    );
  };

  const processWorkerResponseMads = async (
    m: HandledSkynetMessage,
    request: middy.Request,
  ) => {
    const { msgBody, workerResp } = m;
    const middeyInternal: any = await getMiddyInternal(request, ['AWS']);
    const userId: any | undefined = _get(
      msgBody,
      ['context', 'user', 'userId'],
      undefined,
    );

    const accountId: any | undefined = _get(
      msgBody,
      ['context', 'user', 'accountId'],
      undefined,
    );

    let userData: any | undefined = undefined;
    let accountData: any | undefined = undefined;

    if (typeof userId !== 'undefined') {
      userData = await getCurrentUserData(middeyInternal.AWS, options, userId);
    }

    if (typeof accountId !== 'undefined') {
      accountData = await getCurrentAccountData(
        middeyInternal.AWS,
        options,
        accountId,
      );
    }

    const context: any = {};

    if (typeof userData !== 'undefined') {
      context[`user-${userId}`] = await getMiddyInternal(request, [
        `user-${userId}`,
      ]);
    }

    if (typeof accountData !== 'undefined') {
      context[`account-${accountId}`] = await getMiddyInternal(request, [
        `account-${accountId}`,
      ]);
    }

    // * Set defaults if any internal or global MADS do not exist
    const internalAccountMads = _get(internalMadsCache, accountId, {});
    const internalUserMads = _get(internalMadsCache, userId, {});

    const account = _get(context, `account-${accountId}`, {});
    const user = _get(context, `user-${userId}`, {});

    if (!account.hasOwnProperty('globalMicroAppData')) {
      Object.assign(account, { globalMicroAppData: { [options.service]: [] } });
    }
    if (!user.hasOwnProperty('globalMicroAppData')) {
      Object.assign(user, { globalMicroAppData: { [options.service]: [] } });
    }
    if (!account.globalMicroAppData.hasOwnProperty(options.service)) {
      Object.assign(account.globalMicroAppData, { [options.service]: [] });
    }
    if (!user.globalMicroAppData.hasOwnProperty(options.service)) {
      Object.assign(user.globalMicroAppData, { [options.service]: [] });
    }

    if (!internalUserMads.hasOwnProperty(options.service)) {
      internalUserMads[options.service] = [];
    }
    if (!internalAccountMads.hasOwnProperty(options.service)) {
      internalAccountMads[options.service] = [];
    }

    // * user MADS from the process worker response, then overwrite any changes
    if (
      workerResp.hasOwnProperty('microAppData') &&
      workerResp.microAppData.hasOwnProperty('user')
    ) {
      if (typeof userId === 'undefined') {
        throw new Error(
          'Cannot save user microAppData for undefined userId from request',
        );
      }
      let { user: userMads } = workerResp.microAppData;

      // * Validation
      if (!Array.isArray(userMads)) {
        throw new Error(
          'Worker response in user microAppData must be of type Array.',
        );
      }

      userMads.forEach((item) => {
        if (
          !itemExists(item, 'key') ||
          !itemExists(item, 'value') ||
          !itemExists(item, 'readAccess')
        ) {
          throw new Error(
            'Missing a required key (key, value, or readAccess) in a user microAppData item.',
          );
        }
      });

      // Remove objects with undefined value
      userMads = userMads.filter((um) => typeof um.value !== 'undefined');

      const duplicateKey = findDuplicateMadsKeys(userMads);

      if (duplicateKey) {
        throw new Error(
          `Key: ${duplicateKey} in user microAppData array is not unique. All keys in the microAppData arrays must be unique.`,
        );
      }

      // * Overwrite current MADS with the process worker response MADS
      internalUserMads[options.service] = userMads;

      await batchPutIntoDynamoDb(
        middeyInternal.AWS,
        options,
        [internalUserMads],
        'user-mads',
      );
    }

    // * account MADS from the process worker response, then overwrite any changes
    if (
      itemExists(workerResp, 'microAppData') &&
      itemExists(workerResp.microAppData, 'account')
    ) {
      if (typeof accountId === 'undefined') {
        throw new Error(
          'Cannot save user microAppData for undefined accountId from request',
        );
      }

      const { account: accountMads } = workerResp.microAppData;

      // * Validation
      if (!Array.isArray(accountMads)) {
        throw new Error(
          'Worker response in account microAppData must be of type Array.',
        );
      }

      accountMads.forEach((item) => {
        if (
          !itemExists(item, 'key') ||
          !itemExists(item, 'value') ||
          !itemExists(item, 'readAccess')
        ) {
          throw new Error(
            'Missing a required key (key, value, or readAccess) in a account microAppData item.',
          );
        }
      });

      const duplicateKey = findDuplicateMadsKeys(accountMads);

      if (duplicateKey) {
        throw new Error(
          `Key: ${duplicateKey} in account microAppData array is not unique. All keys in the microAppData arrays must be unique.`,
        );
      }

      // * Overwrite current MADS with the process worker response MADS
      internalAccountMads[options.service] = accountMads;

      await batchPutIntoDynamoDb(
        middeyInternal.AWS,
        options,
        [internalAccountMads],
        'account-mads',
      );
    }
  };

  const after: middy.MiddlewareFn<
    SkynetMessage[],
    HandledSkynetMessage[]
  > = async (request): Promise<void> => {
    if (options.debugMode) {
      console.log('after', middlewareName);
    }
    // set changes to serviceUserData/serviceAccountData
    if (request.response) {
      await Promise.all(
        request.response.map((m) => processWorkerResponseMads(m, request)),
      );
    }
  };

  return {
    before,
    after,
  };
};

export default createWithMads;
