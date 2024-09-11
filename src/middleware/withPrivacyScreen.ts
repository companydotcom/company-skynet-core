import middy from '@middy/core';
import _get from 'lodash/get';
import {
  SkynetMessage,
  HandledSkynetMessage,
  Options,
} from '../library/sharedTypes';
import {
  getMiddyInternal,
  prepareMiddlewareDataForWorker,
} from '../library/util';

/*
 * The purpose of the "Privacy screen" is four fold
 * - to isolate any raw dynamo queries stored in request.internal from being exposed to custom-written middleware in individual services
 * - prevent custom-written middleware from overwriting internal storage, while allowing them to safely add to it
 * - parse between the parameter { message, attributes, ...middleware data } format that service workers understand and the more SNS-like format internal middleware use.
 * - ensure the user and account contexts always have the most up-to-date data, while hiding protected fields.
 */
const createWithPrivacyScreen = (
  options: Options,
): middy.MiddlewareObj<[SkynetMessage] | any, [HandledSkynetMessage] | any> => {
  const middlewareName = 'withPrivacyScreen';
  let requestInternalStash = {} as any;

  const fetchContextData = async (
    userId: string,
    accountId: string,
    request: any,
  ) => {
    const context = await getMiddyInternal(request, [
      `user-${userId}`,
      `account-${accountId}`,
    ]);
    ['user', 'account'].forEach((type) => {
      const id = type === 'user' ? userId : accountId;
      if (context[`${type}-${id}`]) {
        ['vendorData', 'globalMicroAppData'].forEach((field) => {
          if (typeof context[`${type}-${id}`][field] !== 'undefined') {
            delete context[`${type}-${id}`][field];
          }
        });
      } else {
        console.log(`${type} - ${id} not found in DB`);
      }
    });
    return context;
  };

  const before: middy.MiddlewareFn<
    [SkynetMessage] | any,
    [HandledSkynetMessage] | any
  > = async (request): Promise<void> => {
    console.log('Running privactyScreen middleware - BEFORE');
    if (options.debugMode) {
      console.log('before', middlewareName);
    }

    const middeyInternal: any = await getMiddyInternal(request, [
      'vendorConfig',
    ]);
    requestInternalStash = { ...request.internal };

    request.event = await Promise.all(
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
        // const context = await getMiddyInternal(request, [`user-${userId}`, `account-${accountId}`]);
        const context = await fetchContextData(userId, accountId, request);

        return {
          message: {
            payload: m.msgBody.payload,
            metadata: m.msgBody.metadata,
            context: {
              ...m.msgBody.context,
              ...(context[`user-${userId}`]
                ? { user: context[`user-${userId}`] }
                : {}),
              ...(context[`account-${accountId}`]
                ? { account: context[`account-${accountId}`] }
                : {}),
            },
          },
          attributes: m.msgAttribs,
          rcptHandle: m.rcptHandle,
          serviceConfigData: middeyInternal.vendorConfig,
          ...(await prepareMiddlewareDataForWorker(request, m)),
        };
      }),
    );
    console.log('Stashing request.internal & reformating event messages');
    request.internal = {};
  };

  const after: middy.MiddlewareFn<
    [SkynetMessage] | any,
    [HandledSkynetMessage] | any
  > = async (request): Promise<void> => {
    if (options.debugMode) {
      console.log('after', middlewareName);
    }
    request.response = request.response.map((m: any) => {
      return {
        msgBody: m.message,
        msgAttribs: m.attributes,
        rcptHandle: m.rcptHandle,
        workerResp: m.workerResp,
        status: m.status,
      };
    });
    console.log('Popping request.internal & reformating event messages');
    request.internal = Object.assign({}, requestInternalStash);
  };

  return {
    before,
    after,
  };
};

export default createWithPrivacyScreen;
