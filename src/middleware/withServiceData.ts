import middy from '@middy/core';
import _get from 'lodash/get';
import {
  HandledSkynetMessage,
  Options,
  SkynetMessage,
} from '../library/sharedTypes';
import {
  itemExists,
  addToEventContext,
  getMiddyInternal,
} from '../library/util';
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from '../library/dynamo';

/**
 * Retrieves data from the specified table using the provided primary key and its value
 * @param AWS AWS SDK variable containing all the exported objects of AWS v3 libraries from awsImports.ts
 * @param options Additional configuration options
 * @param tableName Name of the table to query
 * @param idKey Primary key of the table
 * @param idValue Value of the primary key to look for
 * @returns {Promise<any>} Data returned by the table
 */
const getData = async (
  AWS: any,
  options: Options,
  tableName: string,
  idKey: string,
  idValue: string,
) => {
  const fetchResponse = await fetchRecordsByQuery(AWS, options, {
    TableName: tableName,
    ExpressionAttributeNames: { '#pk': idKey },
    KeyConditionExpression: `#pk = :id`,
    ExpressionAttributeValues: {
      ':id': { S: idValue },
    },
  });
  return fetchResponse[0];
};

// /**
//  * Get the current account data from the database for the given accountId
//  * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
//  * @param {string} accountId is the accountId for which the data needs to be fetched
//  */
// const getCurrentAccountData = async (
//   AWS: any,
//   options: Options,
//   accountId: string,
// ) => {
//   const fetchResponse = await fetchRecordsByQuery(AWS, options, {
//     TableName: 'Account',
//     ExpressionAttributeNames: { '#pk': 'accountId' },
//     KeyConditionExpression: '#pk = :accId',
//     ExpressionAttributeValues: {
//       ':accId': { S: accountId },
//     },
//   });
//   return fetchResponse[0];
// };

/**
 * Get the current user data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} userId is the userId for which the data needs to be fetched
 */
// const getCurrentUserData = async (
//   AWS: any,
//   options: Options,
//   userId: string,
// ) => {
//   const fetchResponse = await fetchRecordsByQuery(AWS, options, {
//     TableName: 'User',
//     ExpressionAttributeNames: { '#pk': 'userId' },
//     KeyConditionExpression: '#pk = :uId',
//     ExpressionAttributeValues: {
//       ':uId': { S: userId },
//     },
//   });
//   return fetchResponse[0];
// };

const getServiceData = (data: any, service: string) =>
  itemExists(data, 'vendorData') && itemExists(data.vendorData, service)
    ? data.vendorData['service']
    : {};

// const getAccountServiceData = async (accData: any, service: string) => {
//   let serviceAccountData = {};

//   if (
//     itemExists(accData, 'vendorData') &&
//     itemExists(accData.vendorData, `${service}`)
//   ) {
//     serviceAccountData = accData.vendorData[`${service}`];
//   }
//   return serviceAccountData;
// };

// const getUserServiceData = async (userData: any, service: string) => {
//   let serviceUserData = {};

//   if (
//     itemExists(userData, 'vendorData') &&
//     itemExists(userData.vendorData, `${service}`)
//   ) {
//     serviceUserData = userData.vendorData[`${service}`];
//   }
//   return serviceUserData;
// };

const defaults = {
  service: '',
};

const withServiceData = (
  opts: Options,
): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const middlewareName = 'withServiceData';
  const options = { ...defaults, ...opts } as Options;
  const serviceDataBefore: middy.MiddlewareFn<
    SkynetMessage[],
    HandledSkynetMessage[]
  > = async (request): Promise<void> => {
    console.log('Running withServiceData middleware - BEFORE');
    if (options.debugMode) {
      console.log('before', middlewareName);
    }
    await Promise.all(
      request.event.map(async (m: SkynetMessage) => {
        const userId: string = _get(
          m,
          ['msgBody', 'context', 'user', 'userId'],
          '',
        );
        const accountId: string = _get(
          m,
          ['msgBody', 'context', 'user', 'accountId'],
          '',
        );

        const context = await getMiddyInternal(request, [
          `user-${userId}`,
          `account-${accountId}`,
        ]);

        const userSD = getServiceData(
          context[`user-${userId}`],
          options.service,
        );
        const accountSD = getServiceData(
          context[`account-${accountId}`],
          options.service,
        );

        console.log('User & Account Service Data Retrieved');
        addToEventContext(request, m, middlewareName, {
          serviceUserData: userSD,
          serviceAccountData: accountSD,
        });
      }),
    );
    // fetch serviceAccountData
  };

  const serviceDataAfter: middy.MiddlewareFn<
    SkynetMessage[],
    HandledSkynetMessage[]
  > = async (request): Promise<void> => {
    if (options.debugMode) {
      console.log('after', middlewareName);
    }
    const middyInternal = await getMiddyInternal(request, ['AWS']);
    const { service } = options;
    // set changes to serviceUserData/serviceAccountData
    if (request.response) {
      await Promise.all(
        request.response.map(async (m: HandledSkynetMessage) => {
          const promises = [] as any[];
          const userId: string = _get(
            m,
            ['msgBody', 'context', 'user', 'userId'],
            '',
          );
          const accountId: string = _get(
            m,
            ['msgBody', 'context', 'user', 'accountId'],
            '',
          );

          const { workerResp } = m;
          if (itemExists(workerResp, 'serviceAccountData')) {
            console.log('Writing serviceAccountData');

            if (typeof workerResp.serviceAccountData !== 'object') {
              throw new Error(
                'Service specific user account data should be an object',
              );
            }
            if (accountId) {
              const currAccData = await getData(
                middyInternal.AWS,
                options,
                'Account',
                'accountId',
                accountId,
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
              promises.push(
                batchPutIntoDynamoDb(
                  middyInternal.AWS,
                  options,
                  [currAccData],
                  'Account',
                ),
              );
            }
          }

          if (itemExists(workerResp, 'serviceUserData')) {
            console.log('Writing serviceUserData');
            if (typeof workerResp.serviceUserData !== 'object') {
              throw new Error('Service specific user data should be an object');
            }
            if (userId) {
              const currUserData = await getData(
                middyInternal.AWS,
                options,
                'User',
                'userId',
                userId,
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

              promises.push(
                batchPutIntoDynamoDb(
                  middyInternal.AWS,
                  options,
                  [currUserData],
                  'User',
                ),
              );
            }
          }
          await promises;
        }),
      );
    }
  };

  return {
    before: serviceDataBefore,
    after: serviceDataAfter,
  };
};

export default withServiceData;
