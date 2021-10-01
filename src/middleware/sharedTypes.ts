import { SQSEvent, ScheduledEvent } from "aws-lambda";
import middy from "@middy/core";

export type Context = {
  user: any;
  account: any;
  product?: any;
  tile?: any;
};

interface TransitionMetadata extends StandardMetadata {
  eventType: string;
  tileId: string;
  stateCurrent: string;
  statePrevious: string;
}

interface StandardMetadata {
  eventType: string;
  tileId: string;
}

type MessageBody = {
  payload?: any;
  context: Context;
  metadata: TransitionMetadata | StandardMetadata;
};

type MessageAttributes = {
  emitter: string;
  eventId: string;
  triggerEventId: string;
  entity: string;
  entityId: string;
  operation: "C";
  status: string;
  eventType: string;
};

export interface SkynetMessage {
  msgBody: MessageBody;
  msgAttribs: MessageAttributes;
  rcptHandle?: any;
}

export interface HandledSkynetMessage extends SkynetMessage {
  workerResp: any;
}

export type RawEvent = SQSEvent | ScheduledEvent;

// type ThrottleLimits = {
//   second?: number;
//   minute?: number;
//   hour?: number;
//   day?: number;
// };

export type ThrottleSettings = {
  throttleLmts: string;
  safeThrottleLimit: number;
  reserveCapForDirect: number;
  retryCntForCapacity: number;
};

export type Options = {
  isBulk?: boolean;
  eventType?: "transition" | "fetch";
  service?: string;
  region?: string;
  account?: string;
  AWS?: any;
  maxMessagesPerInstance?: number;
  throttleOptions?: ThrottleSettings;
};

export interface CoreSkynetConfig {
  eventType: "fetch" | "transition" | "webhook";
  isBulk: boolean;
  region: string;
  service: string;
  account: string;
  useThrottling?: string;
  throttleOptions?: ThrottleSettings;
  maxMessagesPerInstance?: number;
}

export type AllowableConfigKeys =
  | "eventType"
  | "isBulk"
  | "region"
  | "service"
  | "account"
  | "useThrottling"
  | "throttleOptions"
  | "maxMessagesPerInstance";

export const addToEventContext = (
  request: middy.Request,
  message: SkynetMessage,
  middlewareName: string,
  data: any
) => {
  const messageId = message.msgAttribs.eventId;
  if (!request.internal[messageId]) {
    request.internal[messageId] = {};
  }

  request.internal[messageId][middlewareName] = data;
};

export const prepareMiddlewareDataForWorker = async (
  request: middy.Request,
  message: SkynetMessage
) => {
  const messageId = message.msgAttribs.eventId;
  console.log(messageId, "messageId");
  if (!request.internal[messageId]) {
    console.log("no data stored for this message");
    return {};
  }
  const midsInUse = Object.keys(request.internal[messageId]);
  return midsInUse.reduce((acc: any, midName: string): any => {
    const midData = request.internal[messageId][midName];
    const dataKeys = Object.keys(midData);
    dataKeys.forEach((key: string) => {
      if (acc.hasOwnProperty(key)) {
        console.warn(
          `Middleware data key ${key} in middleware ${midName} collides with another middleware's data key.  This is not permitted`
        );
      } else {
        Object.assign(acc, {
          [key]: request.internal[messageId][midName][key],
        });
      }
    });
    return acc;
  }, {} as any);
};

export const setMiddyInternal = (
  request: middy.Request,
  key: string,
  value: any
) => {
  request.internal[key] = value;
};

// Internal Context
export const getMiddyInternal = async (
  request: middy.Request,
  variables: Array<string>
) => {
  if (!variables || !request) return {};
  let keys = [] as any[];
  let values = [] as any[];
  keys = variables;
  const promises = [] as any[];
  keys.forEach((internalKey) => {
    const valuePromise = request.internal[internalKey];
    promises.push(
      valuePromise && valuePromise.then
        ? valuePromise.catch((err: any) => ({
            status: "rejected",
            reason: {
              message: err,
            },
          }))
        : valuePromise
    );
  });
  // ensure promise has resolved by the time it's needed
  // If one of the promises throws it will bubble up to @middy/core
  values = (await Promise.all(promises)) as any[];
  const errors = values
    .filter((res: any) => res.status === "rejected")
    .map((res: any) => res.reason.message);
  if (errors.length) throw new Error(JSON.stringify(errors));
  return keys.reduce(
    (obj, key, index) => ({ ...obj, [key]: values[index] }),
    {}
  );
};
