import middy from "@middy/core";
import {
  HandledSkynetMessage,
  RawEvent,
  Options,
  ThrottleSettings,
} from "../library/sharedTypes";

import { getMiddyInternal } from "../library/util";

import {
  getAvailableCallsThisSec as getAvailableCapacity,
  incrementUsedCount,
} from "../library/throttle";

const defaults = {
  isBulk: false,
  throttleOptions: {
    throttleLmts: {},
    safeThrottleLimit: 0.1,
    reserveCapForDirect: 0.9,
    retryCntForCapacity: 3,
  },
};

type SettledOptions = {
  isBulk: boolean;
  eventType: "transition" | "fetch";
  service: string;
  region: string;
  account: string;
  AWS?: any;
  maxMessagesPerInstance: number;
  throttleOptions: ThrottleSettings;
};

const createWithThrottling = (
  opt: Options
): middy.MiddlewareObj<RawEvent, [HandledSkynetMessage]> => {
  const options = { ...defaults, ...opt } as SettledOptions;

  // REQUEST HAS "event" "context" "response" and "error" keys
  const throttleBefore: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> =
    async (request): Promise<void> => {
      // fetch callCount records from dynamo
      // compare to options ThrottleLmts
      // set availCap to `internal`
      // if no capacity "return" early

      // need to figure out increment
      const availCap = await getAvailableCapacity(
        options.AWS,
        options.throttleOptions,
        options.service,
        options.isBulk
      );

      if (availCap < 1) {
        console.log("No Capacity available for requests");
        return;
      }
      request.internal.availCap = options.isBulk ? availCap : 1;
      await incrementUsedCount(
        options.AWS,
        options.service,
        options.isBulk ? availCap : 1
      );
    };

  // eventually need to consider how to handled workers that are calling multiple apis which have different api call limits.  ways which we can wrap individual api calls and track in that manner based on doing an estimation based on an entire lambda execution.

  const throttleAfter: middy.MiddlewareFn<RawEvent, [HandledSkynetMessage]> =
    async (request): Promise<void> => {
      // if request contains key to adjust used capacity
      // - adjust call count
      const data = await getMiddyInternal(request, ["availCap"]);
      if (data.availCap) {
        let processedCount = 0;
        if (request.response && request.response.length) {
          processedCount = request.response.length;
        }
        // TODO: consider implications of this "post operation adjustment" on esp. per Second throttling - however since bulk operations only run every 5 minutes it should be acceptable to not do a "pre-operation" update - meaning that this number doesn't need to be negative.  (of course the "perSecond" has never been truly accurate).  This being given that the "reservedCapForDirect" is high enough as well as the "max usage" value (whatever its called)
        await incrementUsedCount(
          options.AWS,
          options.service,
          processedCount - data.availCap
        );
      }
    };

  const onError = () => {
    // TODO: adjust availCap.  check to see if request.response exists, if not, no throughput was used
  };

  return {
    before: throttleBefore,
    after: throttleAfter,
    onError,
  };
};

export default createWithThrottling;
