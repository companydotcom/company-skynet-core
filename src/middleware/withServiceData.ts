import middy from "@middy/core";
import _get from "lodash/get";
import {
  addToEventContext,
  HandledSkynetMessage,
  Options,
  SkynetMessage,
  getMiddyInternal,
} from "./sharedTypes";
import { itemExists } from "../library/util";
import { fetchRecordsByQuery, batchPutIntoDynamoDb } from "../library/dynamo";

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

const getAccountServiceData = async (accData: any, service?: string) => {
  let serviceAccountData = {};

  if (
    itemExists(accData, "vendorData") &&
    itemExists(accData.vendorData, `${service}`)
  ) {
    serviceAccountData = accData.vendorData[`${service}`];
  }
  return serviceAccountData;
};

const getUserServiceData = async (userData: any, service?: string) => {
  let serviceUserData = {};

  if (
    itemExists(userData, "vendorData") &&
    itemExists(userData.vendorData, `${service}`)
  ) {
    serviceUserData = userData.vendorData[`${service}`];
  }
  return serviceUserData;
};

const defaults = {
  service: "",
};

const withServiceData = (
  opts: Options
): middy.MiddlewareObj<[SkynetMessage], [HandledSkynetMessage]> => {
  const middlewareName = "withServiceData";
  const options = { ...defaults, ...opts } as Options;
  const serviceDataBefore: middy.MiddlewareFn<
    SkynetMessage[],
    HandledSkynetMessage[]
  > = async (request): Promise<void> => {
    await Promise.all(
      request.event.map(async (m: SkynetMessage) => {
        const userId: string = _get(
          m,
          ["msgBody", "context", "user", "userId"],
          ""
        );
        const accountId: string = _get(
          m,
          ["msgBody", "context", "user", "accountId"],
          ""
        );

        const context = await getMiddyInternal(request, [
          `user-${userId}`,
          `account-${accountId}`,
        ]);
        console.log("here");

        const userSD = await getUserServiceData(
          context[`user-${userId}`],
          options.service
        );
        const accountSD = await getAccountServiceData(
          context[`account-${accountId}`],
          options.service
        );
        addToEventContext(request, m, middlewareName, {
          serviceUserData: userSD,
          serviceAccountData: accountSD,
        });
      })
    );
    // fetch serviceAccountData
  };

  const serviceDataAfter: middy.MiddlewareFn<
    SkynetMessage[],
    HandledSkynetMessage[]
  > = async (request): Promise<void> => {
    const { AWS, service } = options;
    // set changes to serviceUserData/serviceAccountData
    if (request.response) {
      Promise.all(
        request.response.map(async (m: HandledSkynetMessage) => {
          const userId: string = _get(
            m,
            ["msgBody", "context", "user", "userId"],
            ""
          );
          const accountId: string = _get(
            m,
            ["msgBody", "context", "user", "accountId"],
            ""
          );

          const { workerResp } = m;
          if (itemExists(workerResp, "serviceAccountData")) {
            if (typeof workerResp.serviceAccountData !== "object") {
              throw new Error(
                "Service specific user account data should be an object"
              );
            }
            if (accountId) {
              const currAccData = await getCurrentAccountData(AWS, accountId);
              if (!itemExists(currAccData, "vendorData")) {
                currAccData.vendorData = {};
              }
              if (!itemExists(currAccData.vendorData, `${service}`)) {
                currAccData.vendorData[`${service}`] = {};
              }
              currAccData.vendorData[`${service}`] = {
                ...currAccData.vendorData[`${service}`],
                ...workerResp.serviceAccountData,
              };
              await batchPutIntoDynamoDb(AWS, [currAccData], "Account");
            }
          }

          if (itemExists(workerResp, "serviceUserData")) {
            if (typeof workerResp.serviceUserData !== "object") {
              throw new Error("Service specific user data should be an object");
            }
            if (userId) {
              const currUserData = await getCurrentUserData(AWS, userId);
              if (!itemExists(currUserData, "vendorData")) {
                currUserData.vendorData = {};
              }
              if (!itemExists(currUserData.vendorData, `${service}`)) {
                currUserData.vendorData[`${service}`] = {};
              }
              currUserData.vendorData[`${service}`] = {
                ...currUserData.vendorData[`${service}`],
                ...workerResp.serviceUserData,
              };
              await batchPutIntoDynamoDb(AWS, [currUserData], "User");
            }
          }
        })
      );
    }
  };

  return {
    before: serviceDataBefore,
    after: serviceDataAfter,
  };
};

export default withServiceData;
