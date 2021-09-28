import middy from '@middy/core';
import { getInternal } from '@middy/util';
import _get from 'lodash/get';
import { SkynetMessage, HandledSkynetMessage, addToEventContext, Options } from './sharedTypes';
import {
  transformMadsToReadFormat,
  evaluateMadsReadAccess,
  fetchRecordsByQuery,
  itemExists,
  findDuplicateMadsKeys,
  filterMadsByReadAccess,
  /* tslint:disable-next-line */
} from '../library/util.js';
/* tslint:disable-next-line */
import { batchPutIntoDynamoDb } from '../library/dynamo';

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

const createWithMads = (opts: Options): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const options = { ...opts, ...defaults };
  const middlewareName = 'mads';
  const internalMadsCache = {} as object;
  const { AWS, service } = options;

  const before: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> = async (request): Promise<void> => {
    const { service, AWS } = options;
    Promise.all(
      request.event.map(async (m: SkynetMessage) => {
        const userId: string = _get(m, ['msgBody', 'context', 'user', 'userId'], '');
        const accountId: string = _get(m, ['msgBody', 'context', 'user', 'userId'], '');

        const [context, internalAccountMads, internalUserMads] = await Promise.all([
          getInternal([`user-${userId}`, `account-${accountId}`], request),
          getInternalAccountMads(AWS, accountId),
          getInternalUserMads(AWS, userId),
        ]);

        Object.defineProperty(internalMadsCache, userId, internalUserMads || {});
        Object.defineProperty(internalMadsCache, accountId, internalAccountMads || {});

        const accountGlobalMicroAppData = _get(context, `account-${accountId}.globalMicroAppData`, null);
        const userGlobalMicroAppData = _get(context, `user-${userId}.globalMicroAppData`, null);

        const globalMicroAppData = {
          user: {} as object,
          account: {} as object,
        };

        // * Evaluate and transform global MADS
        if (accountGlobalMicroAppData) {
          globalMicroAppData.account = transformMadsToReadFormat(
            evaluateMadsReadAccess(accountGlobalMicroAppData, service),
          );
        }
        if (userGlobalMicroAppData) {
          globalMicroAppData.user = transformMadsToReadFormat(evaluateMadsReadAccess(userGlobalMicroAppData, service));
        }

        // * No need to evaluate internal MADS because they are
        // * only for the internal Micro Application
        // * Transform internal User MADS
        // * Transform internal Account MADS
        let internalMicroAppData = {
          user: {} as object,
          account: {} as object,
        };
        const serviceUserMads = _get(internalUserMads, service);
        const serviceAccountMads = _get(internalAccountMads, service);
        if (serviceUserMads) {
          internalMicroAppData.user = transformMadsToReadFormat(serviceUserMads);
        }
        if (serviceAccountMads) {
          internalMicroAppData.account = transformMadsToReadFormat(serviceAccountMads);
        }

        addToEventContext(request, m, middlewareName, {
          internalMicroAppData,
          globalMicroAppData,
        });
      }),
    );
  };

  const processWorkerResponseMads = async (m: HandledSkynetMessage, request: middy.Request) => {
    const { msgBody, workerResp } = m;
    const userId: string = _get(msgBody, ['context', 'user', 'userId'], '');
    const accountId: string = _get(msgBody, ['context', 'user', 'userId'], '');

    const [context] = await Promise.all([getInternal([`user-${userId}`, `account-${accountId}`], request)]);

    const userData = _get(context, `user-${userId}`);
    const accData = _get(context, `account-${accountId}`);

    // * Set defaults if any internal or global MADS do not exist
    const internalAccountMads = _get(internalMadsCache, accountId, {});
    const internalUserMads = _get(internalMadsCache, userId, {});

    const accountGlobalMicroAppData = _get(context, `account-${accountId}.globalMicroAppData`, {});
    const userGlobalMicroAppData = _get(context, `user-${userId}.globalMicroAppData`, {});

    if (!accountGlobalMicroAppData.hasOwnProperty(service)) {
      Object.defineProperty(accountGlobalMicroAppData, service, []);
    }
    if (!userGlobalMicroAppData.hasOwnProperty(service)) {
      Object.defineProperty(userGlobalMicroAppData, service, []);
    }

    if (!internalUserMads.hasOwnProperty(service)) {
      internalUserMads[service] = [];
    }
    if (!internalAccountMads.hasOwnProperty(service)) {
      internalAccountMads[service] = [];
    }

    // * Validate any changes to the global and internal
    // * user MADS from the process worker response, then overwrite any changes
    if (workerResp.hasOwnProperty('microAppData') && workerResp.microAppData.hasOwnProperty('user')) {
      const { user: userMads } = workerResp.microAppData;

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

      await Promise.all([
        await batchPutIntoDynamoDb(AWS, [userData], 'User'),
        await batchPutIntoDynamoDb(AWS, [internalUserMads], 'internal-user-mads'),
      ]);
    }

    // * Validate any changes to the global and internal
    // * account MADS from the process worker response, then overwrite any changes
    if (itemExists(workerResp, 'microAppData') && itemExists(workerResp.microAppData.account)) {
      const { account: accountMads } = workerResp.microAppData;

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

      accData.globalMicroAppData[service] = globalMads;
      internalAccountMads[service] = internalMads;

      Promise.all([
        batchPutIntoDynamoDb(AWS, [accData], 'Account'),
        batchPutIntoDynamoDb(AWS, [internalAccountMads], 'internal-account-mads'),
      ]);
    }
  };

  const after: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> = async (request): Promise<void> => {
    // set changes to serviceUserData/serviceAccountData
    if (request.response) {
      await Promise.all(request.response.map((m) => processWorkerResponseMads(m, request)));
    }
  };

  return {
    before,
    after,
  };
};

export default createWithMads;
