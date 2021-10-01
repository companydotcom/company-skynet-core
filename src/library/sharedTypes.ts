import { SQSEvent, ScheduledEvent } from "aws-lambda";

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
