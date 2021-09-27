import middy from '@middy/core';
import { getInternal }  from '@middy/util';
import { SQSEvent, ScheduledEvent } from 'aws-lambda';


import {  getAvailableCallsThisSec as getAvailableCapacity, incrementUsedCount } from '../library/throttle';


const defaults = {
  isBulk: false,
  throttleLmts: {},
  safeThrottleLimit: 0.1,
  reserveCapForDirect: 0.9,
  retryCntForCapacity: 3,
};

type Options = {
  AWS: any;
  isBulk: boolean;
  throtteLmts: any;
  service: string;
  safeThrottleLimit: number;
  reserveCapForDirect: number;
  retryCntForCapacity: number;
}

const createWithThrottling = (opt: Options): middy.MiddlewareObj<SQSEvent, any> => {
  const options = { ...defaults, ...opt };

  // REQUEST HAS "event" "context" "response" and "error" keys
  const throttleBefore: middy.MiddlewareFn<SQSEvent, any> = async (
    request
  ): Promise<void> => {
    // fetch callCount records from dynamo
    // compare to options ThrottleLmts
    // set availCap to `internal`
    // if no capacity "return" early

    // need to figure out increment
    const availCap = await getAvailableCapacity(
      options.AWS,
      options,
      options.service,
      options.isBulk,
    );

    if (availCap < 1) {
      console.log('No Capacity available for requests');
      return;
    }
    request.internal.availCap = availCap;
    await incrementUsedCount(options.AWS, options.service, options.isBulk ? availCap : 1);
  };

  const throttleAfter: middy.MiddlewareFn<SQSEvent, any> = async (
    request
  ): Promise<void> => {
    // if request contains key to adjust used capacity
    // - adjust call count
    const data = getInternal(['messagesToProcess', 'availCap'], request);
    if (data.availCap && data.messagesToProcess) {
      // TODO: consider implications of this "post operation adjustment" on esp. per Second throttling - however since bulk operations only run every 5 minutes it should be acceptable to not do a "pre-operation" update - meaning that this number doesn't need to be negative.  (of course the "perSecond" has never been truly accurate).  This being given that the "reservedCapForDirect" is high enough as well as the "max usage" value (whatever its called)

      await incrementUsedCount(options.AWS, options.service, data.messagesToProcess.length - data.availCap)
    }
  };

  return {
    before: throttleBefore,
    after: throttleAfter,
  };
};

export default createWithThrottling;
