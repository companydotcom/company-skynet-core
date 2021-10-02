import middy from '@middy/core';
import _get from 'lodash/get';
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
  filterMadsByReadAccess,
  addToEventContext,
  getMiddyInternal,
} from '../library/util';
import { batchPutIntoDynamoDb, fetchRecordsByQuery } from '../library/dynamo';

const getInternalAccountMads = async (AWS: any, accountId: string) => {
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

const getInternalUserMads = async (AWS: any, userId: string) => {
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

const defaults = {
  service: '',
};

const createWithMads = (
  opts: Options
): middy.MiddlewareObj<SkynetMessage[], HandledSkynetMessage[]> => {
  const options = { ...defaults, ...opts };
  const middlewareName = 'withMads';
  const internalMadsCache = {} as any;
  const { AWS, service } = options;

  const before: middy.MiddlewareFn<SkynetMessage[], HandledSkynetMessage[]> =
    async (request): Promise<void> => {
      if (options.debugMode) {
        console.log('before', middlewareName);
      }
      const { service, AWS } = options;
      await Promise.all(
        request.event.map(async (m: SkynetMessage) => {
          const userId: string = _get(
            m,
            ['msgBody', 'context', 'user', 'userId'],
            ''
          );
          const accountId: string = _get(
            m,
            ['msgBody', 'context', 'user', 'accountId'],
            ''
          );

          const [context, internalAccountMads, internalUserMads] =
            await Promise.all([
              getMiddyInternal(request, [
                `user-${userId}`,
                `account-${accountId}`,
              ]),
              getInternalAccountMads(AWS, accountId),
              getInternalUserMads(AWS, userId),
            ]);

          Object.assign(
            internalMadsCache,
            internalUserMads
              ? {
                  [userId]: internalUserMads,
                }
              : {
                  [userId]: { userId },
                }
          );
          Object.assign(
            internalMadsCache,
            internalAccountMads
              ? {
                  [accountId]: internalAccountMads,
                }
              : {
                  [accountId]: { accountId },
                }
          );

          const accountGlobalMicroAppData = _get(
            context,
            `account-${accountId}.globalMicroAppData`,
            null
          );
          const userGlobalMicroAppData = _get(
            context,
            `user-${userId}.globalMicroAppData`,
            null
          );

          const globalMicroAppData = {
            user: {} as any,
            account: {} as any,
          };

          // * Evaluate and transform global MADS
          if (accountGlobalMicroAppData) {
            globalMicroAppData.account = transformMadsToReadFormat(
              evaluateMadsReadAccess(accountGlobalMicroAppData, service)
            );
          }
          if (userGlobalMicroAppData) {
            globalMicroAppData.user = transformMadsToReadFormat(
              evaluateMadsReadAccess(userGlobalMicroAppData, service)
            );
          }

          // * No need to evaluate internal MADS because they are
          // * only for the internal Micro Application
          // * Transform internal User MADS
          // * Transform internal Account MADS
          const internalMicroAppData = {
            user: {} as any,
            account: {} as any,
          };
          const serviceUserMads = {
            [service]: _get(internalUserMads, service),
          };
          const serviceAccountMads = {
            [service]: _get(internalAccountMads, service),
          };

          if (serviceUserMads) {
            internalMicroAppData.user =
              transformMadsToReadFormat(serviceUserMads);
          }
          if (serviceAccountMads) {
            internalMicroAppData.account =
              transformMadsToReadFormat(serviceAccountMads);
          }

          addToEventContext(request, m, middlewareName, {
            internalMicroAppData,
            globalMicroAppData,
          });
        })
      );
    };

  const processWorkerResponseMads = async (
    m: HandledSkynetMessage,
    request: middy.Request
  ) => {
    const { msgBody, workerResp } = m;
    const userId: string = _get(msgBody, ['context', 'user', 'userId'], '');
    const accountId: string = _get(
      msgBody,
      ['context', 'user', 'accountId'],
      ''
    );
    const context = await getMiddyInternal(request, [
      `user-${userId}`,
      `account-${accountId}`,
    ]);

    const userData = _get(context, `user-${userId}`);
    const accData = _get(context, `account-${accountId}`);

    // * Set defaults if any internal or global MADS do not exist
    const internalAccountMads = _get(internalMadsCache, accountId, {});
    const internalUserMads = _get(internalMadsCache, userId, {});

    const account = _get(context, `account-${accountId}`, {});
    const user = _get(context, `user-${userId}`, {});

    if (!account.hasOwnProperty('globalMicroAppData')) {
      Object.assign(account, { globalMicroAppData: { [service]: [] } });
    }
    if (!user.hasOwnProperty('globalMicroAppData')) {
      Object.assign(user, { globalMicroAppData: { [service]: [] } });
    }
    if (!account.globalMicroAppData.hasOwnProperty(service)) {
      Object.assign(account.globalMicroAppData, { [service]: [] });
    }
    if (!user.globalMicroAppData.hasOwnProperty(service)) {
      Object.assign(user.globalMicroAppData, { [service]: [] });
    }

    if (!internalUserMads.hasOwnProperty(service)) {
      internalUserMads[service] = [];
    }
    if (!internalAccountMads.hasOwnProperty(service)) {
      internalAccountMads[service] = [];
    }

    // * Validate any changes to the global and internal
    // * user MADS from the process worker response, then overwrite any changes
    if (
      workerResp.hasOwnProperty('microAppData') &&
      workerResp.microAppData.hasOwnProperty('user')
    ) {
      const { user: userMads } = workerResp.microAppData;

      // * Validation
      if (!Array.isArray(userMads)) {
        throw new Error(
          'Worker response in user microAppData must be of type Array.'
        );
      }

      userMads.forEach((item) => {
        if (
          !itemExists(item, 'key') ||
          !itemExists(item, 'value') ||
          !itemExists(item, 'readAccess')
        ) {
          throw new Error(
            'Missing a required key (key, value, or readAccess) in a user microAppData item.'
          );
        }
      });

      const duplicateKey = findDuplicateMadsKeys(userMads);

      if (duplicateKey) {
        throw new Error(
          `Key: ${duplicateKey} in user microAppData array is not unique. All keys in the microAppData arrays must be unique.`
        );
      }

      // * Overwrite current MADS with the process worker response MADS
      const [internalMads, globalMads] = filterMadsByReadAccess(userMads);

      userData.globalMicroAppData[service] = globalMads;
      internalUserMads[service] = internalMads;

      await Promise.all([
        await batchPutIntoDynamoDb(AWS, [userData], 'User'),
        await batchPutIntoDynamoDb(
          AWS,
          [internalUserMads],
          'internal-user-mads'
        ),
      ]);
    }

    // * Validate any changes to the global and internal
    // * account MADS from the process worker response, then overwrite any changes
    if (
      itemExists(workerResp, 'microAppData') &&
      itemExists(workerResp.microAppData, 'account')
    ) {
      const { account: accountMads } = workerResp.microAppData;

      // * Validation
      if (!Array.isArray(accountMads)) {
        throw new Error(
          'Worker response in account microAppData must be of type Array.'
        );
      }

      accountMads.forEach((item) => {
        if (
          !itemExists(item, 'key') ||
          !itemExists(item, 'value') ||
          !itemExists(item, 'readAccess')
        ) {
          throw new Error(
            'Missing a required key (key, value, or readAccess) in a account microAppData item.'
          );
        }
      });

      const duplicateKey = findDuplicateMadsKeys(accountMads);

      if (duplicateKey) {
        throw new Error(
          `Key: ${duplicateKey} in account microAppData array is not unique. All keys in the microAppData arrays must be unique.`
        );
      }

      // * Overwrite current MADS with the process worker response MADS
      const [internalMads, globalMads] = filterMadsByReadAccess(accountMads);

      accData.globalMicroAppData[service] = globalMads;
      internalAccountMads[service] = internalMads;
      Promise.all([
        batchPutIntoDynamoDb(AWS, [accData], 'Account'),
        batchPutIntoDynamoDb(
          AWS,
          [internalAccountMads],
          'internal-account-mads'
        ),
      ]);
    }
  };

  const after: middy.MiddlewareFn<SkynetMessage[], HandledSkynetMessage[]> =
    async (request): Promise<void> => {
      if (options.debugMode) {
        console.log('after', middlewareName);
      }
      // set changes to serviceUserData/serviceAccountData
      if (request.response) {
        await Promise.all(
          request.response.map((m) => processWorkerResponseMads(m, request))
        );
      }
    };

  return {
    before,
    after,
  };
};

export default createWithMads;
