import middy from "@middy/core";

import { HandledSkynetMessage, SkynetMessage, Options } from "./sharedTypes";
import { fetchRecordsByQuery } from "../library/dynamo";

const defaults = {
  region: "us-east-1",
};

/**
 * Get the current account data from the database for the given accountId
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} accountId is the accountId for which the data needs to be fetched
 */
const getCurrentAccountData = async (AWS: any, accountId: string) => {
  const fetchResponse = await fetchRecordsByQuery(AWS, {
    TableName: "Account",
    ExpressionAttributeNames: { "#pk": "accountId" },
    KeyConditionExpression: "#pk = :accId",
    ExpressionAttributeValues: {
      ":accId": { S: accountId },
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
    TableName: "User",
    ExpressionAttributeNames: { "#pk": "userId" },
    KeyConditionExpression: "#pk = :uId",
    ExpressionAttributeValues: {
      ":uId": { S: userId },
    },
  });
  return fetchResponse[0];
};

const createWithContextPrep = (
  opt: Options
): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const options = { ...defaults, ...opt };
  const before: middy.MiddlewareFn<[SkynetMessage], [HandledSkynetMessage]> =
    async (request): Promise<void> => {
      request.event.map(async (m) => {
        const userId = m.msgBody.context.user.userId;
        request.internal[`user-${userId}`] = getCurrentUserData(
          options.AWS,
          userId
        );
        const accountId = m.msgBody.context.user.accountId;
        const account = getCurrentAccountData(options.AWS, accountId);
        request.internal[`account-${accountId}`] = account;
        m.msgBody.context.user.account = account;
      });
    };

  return {
    before,
  };
};

export default createWithContextPrep;
