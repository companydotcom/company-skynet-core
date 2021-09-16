
import { processMessage } from '../library/process';
import { getErrorString } from '../library/util';
import { parseMsg as sqsParser } from '../library/queue';
import {
  getAvailableCallsThisSec as getAvailableCapacity,
  incrementUsedCount as incCallCount,
} from '../library/throttle';

/**
 * This is the handler that is invoked by a SQS trigger to process
 * messages that are waiting in the bulk transition queue
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {object} { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity } are the throttle limits from env
 * @param {string} region is the region of AWS that this service is running in
 * @param {string} service is the name of the service
 * @param {string} account is AWS the account number
 * @param {object} event that invokes the serverless function. In this case, it is a cloud watch trigger
 * @param {function} mHndlr is the handler/ worker that works on the message applying business logic
 * @param {function} preWorkerHook custom logic to handle complex throttling or prioritization
 * @returns {string}
 * @throws {Error}
 */
export const handler = async (
  AWS,
  {
    throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity,
  }, region, service, account, event, mHndlr, preWorkerHook) => {
  try {
    console.log(`directFetch: INFO: Input is: ${typeof event === 'object' ? JSON.stringify(event, null, 4) : event}`);

    // If there are no records to process or more than one record to process,
    // throw an error as it is an invalid event
    if (typeof event.Records === 'undefined' || event.Records.length !== 1) {
      throw new Error(`directFetch: ERROR: Lambda was wrongly triggered with ${typeof event.Records === 'undefined' ? 0 : event.Records.length} records`);
    }

    // Get the available capacity for making calls before going any further
    const availCap = await getAvailableCapacity(
      AWS,
      {
        throttleLmts,
        safeThrottleLimit,
        reserveCapForDirect,
        retryCntForCapacity,
      }, service, false,
    );
    console.log(`directFetch: INFO: Processing event ${JSON.stringify(event.Records.length, null, 4)}`);

    let approvedMessages = [sqsParser(event.Records[0])];
    if (preWorkerHook) {
      approvedMessages = await preWorkerHook('fetch', false, approvedMessages);
    }

    if (!approvedMessages.length) {
      throw new Error('directFetch: ERROR: Processing complete.  Pre-worker hook rejected message.');
    }

    // If there is no available capacity to make calls, throw an error which
    // will put back the message in the queue where it came from
    if (availCap < 1) {
      throw new Error('directFetch: ERROR: No capacity to make a call');
    }

    // Increment the 'calls made count' in the database. Default increment is 1
    // Therefore, no need to send the increment parameter
    await incCallCount(AWS, service);

    // Parse the message using the sqsParser function from queue library
    const { msgBody, msgAttribs } = approvedMessages[0];

    // Call the message processer to process the message which includes error
    // handling and publishing response to SNS
    await processMessage(AWS, region, service, account, { msgBody, msgAttribs },
      mHndlr);

    return 'directFetch: INFO: Processing complete';
  } catch (e) {
    console.log(`directFetch: ERROR: ${getErrorString(e)}`);
    throw e;
  }
};
