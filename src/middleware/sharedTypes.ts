import { SQSEvent, ScheduledEvent } from 'aws-lambda';

type ParsedSqs = {
  body: any;
  attributes: any;
}

export type RawEvent = SQSEvent | ScheduledEvent;

export type ProcessedEvent = [ParsedSqs];

export type HandledMessage = {
  msgBody: any;
  msgAttribs: any;
  workerResp: any;
}

type ThrottleLimits = {
  second?: number;
  minute?: number;
  hour?: number;
  day?: number;
}

type ThrottleSettings = {
  throttleLmts: ThrottleLimits;
  safeThrottleLimit: number;
  reserveCapForDirect: number;
  retryCntForCapacity: number;
}

export interface CoreSkynetConfig {
  eventType: 'fetch' | 'transition' | 'webhook';
  isBulk: boolean;
  region: string;
  service: string;
  account: string;
  useThrottling?: string;
  throttleOptions?: ThrottleSettings;
  maxMessagesPerInstance?: number;
}