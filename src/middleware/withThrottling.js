import { getMsgsFromQueue, parseMsg as sqsParser } from '../library/queue';
import getAvailableCapacity from '../library/throttle';


const defaults = {
  isBulk: false,
  throttleLmts: {},
  safeThrottleLimit: 0.1,
  reserveCapForDirect: 0.9,
  retryCntForCapacity: 3,
  queueName: '',
};

const { account, service, region } = process.env;

const createWithThrottling = opts => {
  const options = { ...defaults, ...opts };

  const AWS;

  // REQUEST HAS "event" "context" "response" and "error" keys
  const throttleBefore = async request => {
    // fetch callCount records from dynamo
    // compare to options ThrottleLmts
    // set availCap to `internal`
    // if no capacity "return" early

    // need to figure out increment
    const availCap = await getAvailableCapacity(
      AWS,
      options,
      service,
      true,
    );

    if (options.isBulk && availCap < 1) {
      console.log('No Capacity available for bulk requests');
      return;
    } else if (!options.isBulk && request.Records.length !== 1) {
      console.log(`Direct processing Error: Lambda was wrongly triggered with ${typeof request.Records === 'undefined' ? 0 : request.Records.length} records`);
      return;
    }

    if (options.isBulk) {
      const messagesToProcess = await getMsgsFromQueue(AWS, region, availCap, `https://sqs.${region}.amazonaws.com/${account}/${service}-${options.queueName}`);
      request.messagesToProcess = messagesToProcess.map(m => sqsParser(m))
    } else {
      request.messagesToProcess = [sqsParser(request.Records[0])]
    }
  };

  const throttleAfter = async request => {
    // if request contains key to adjust used capacity
    // - adjust call count
    if () {}
  };

  return {
    before: throttleBefore,
    after: throttleAfter,
  };
};

export default createWithThrottling;
