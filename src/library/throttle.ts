import { fetchRecordsByQuery, incrementColumn } from './dynamo';
import { sleep } from './util';
import {
  Options,
} from '../library/sharedTypes';

/**
 * Fetches and returns the number of calls made to the service for the given
 * day, hour, minute and second
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {String} serviceName is the service for which the metrics are to be fetched
 * @returns {{ second: Number, minute: Number, hour: Number, day: Number }}
 */
export const getCallsMade = async (AWS: any, options: any) => {
  const currMs = Date.now();
  // Get the next second (without the milliseconds)
  const currSec = Math.floor(currMs / 1000) + 1;
  // Get the next minute at its second 0
  const currMin = currSec - (currSec % 60) + 60;
  // Get the next hour at its 0th minute and 0th second
  const currHr = currMin - (currMin % (60 * 60)) + 60 * 60;
  // Get the next day at 00:00:00
  const currDay = currHr - (currHr % (24 * 60 * 60)) + 24 * 60 * 60;

  // Construct the common properties for the next queries
  const queryObj = {
    TableName: 'apiCallCount',
    ExpressionAttributeNames: {
      '#pk': 'serviceAndDuration',
      '#et': 'expiryTime',
    },
    KeyConditionExpression: '#pk = :sd AND #et = :et',
  };

  // Generate a list of promises to get the records for current second, minute,
  // hour and day
  const timeUnitsAndValues = [
    { unit: 'second', value: currSec },
    { unit: 'minute', value: currMin },
    { unit: 'hour', value: currHr },
    { unit: 'day', value: currDay },
  ];

  const proms = timeUnitsAndValues.map((timeUnitAndValue) => {
    fetchRecordsByQuery(AWS, 
      options,
      {
      ...queryObj,
      ExpressionAttributeValues: {
        ':sd': { S: `${options.serviceName}-${timeUnitAndValue.unit}` },
        ':et': { N: timeUnitAndValue.value.toString() },
      },
    });
  });

  const promRes: any = await Promise.all(proms);

  return timeUnitsAndValues.reduce((acc: any, timeUnitAndValue, index) => {
      acc[timeUnitAndValue.unit] = (promRes[index] && typeof promRes[index].callCount !=='undefined') ? promRes[index].callCount : 0;
      return acc;
    }, {});
};

type arg = {
  throttleLmts: any;
  safeThrottleLimit: number;
  reserveCapForDirect: number;
  retryCntForCapacity: number;
};

/**
 * Gets the count of calls that can be made this second without hitting the
 * throttle limit
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {object} options defines the api limits and how close to maximum threshold the service should be allowed to use
 * @param {String} serviceName is the name of the service for which the count is required
 * @param {Boolean} bulk tells whether the call is going to be bulk or direct
 * @returns {Number}
 */
export const getAvailableCallsThisSec = async (
  AWS: any,
  options: Options,
): Promise<number> => {
  const { throttleOptions, service: serviceName, bulk, iter = 0 }: any = options;
  const {
    throttleLmts, 
    safeThrottleLimit, 
    reserveCapForDirect, 
    retryCntForCapacity,
  }: arg = throttleOptions;
  if (iter > retryCntForCapacity) {
    return 0;
  }

  if (iter > 0) {
    await sleep(1000);
  }
  const throtLmts = JSON.parse(throttleLmts);

  const noLimits = ['day', 'hour', 'minute', 'second'].every(
    unit => throtLmts[unit] === undefined
  );

  if (noLimits) {
    return 1000000;
  }

  const resFact =
    bulk === true
      ? (1 - reserveCapForDirect) * safeThrottleLimit
      : 1 * safeThrottleLimit;
  const callsMade: any = await getCallsMade(AWS, { ...options, serviceName });
  let availLmt = Number.MAX_SAFE_INTEGER;

  const units = ['day', 'hour', 'minute', 'second'];
  for (const unit of units) {
    if (
      typeof throtLmts[unit] !== 'undefined' &&
      Math.floor(throtLmts[unit] * resFact - callsMade[unit]) < availLmt
    ) {
      availLmt = Math.floor(throtLmts[unit] * resFact - callsMade[unit]);
    }
  }

  return availLmt > 0
    ? availLmt
    : getAvailableCallsThisSec(
        AWS,
        {
          ...options,
          iter: iter + 1,
        },
      );
};

/**
 * Increments the per second, minute, hour and day calls made count to the
 * given increment count which is 1 by default
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {String} serviceName is the name of the service
 * @param {Number} incVal is the increment value. Defaults to 1
 * @returns {Boolean}
 */
export const incrementUsedCount = async (
  AWS: any,
  options: any,
  // serviceName: string,
  incVal = 1
) => {
  const currMs = Date.now();
  const currSec = Math.floor(currMs / 1000) + 1;
  const currMin = currSec - (currSec % 60) + 60;
  const currHr = currMin - (currMin % (60 * 60)) + 60 * 60;
  const currDay = currHr - (currHr % (24 * 60 * 60)) + 24 * 60 * 60;

  const durations = [
    { unit: 'second', expiry: currSec },
    { unit: 'minute', expiry: currMin },
    { unit: 'hour', expiry: currHr },
    { unit: 'day', expiry: currDay },
  ];
  const proms = durations.map(async (d) => {
    return incrementColumn(
      AWS,
      options,
      'apiCallCount',
      {
        serviceAndDuration: `${options.serviceName}-${d.unit}`,
        expiryTime: d.expiry,
      },
      'callCount',
      incVal
    );
  });

  await Promise.all(proms);
  return true;
};
//   const proms = [
//     incrementColumn(
//       AWS,
//       'apiCallCount',
//       {
//         serviceAndDuration: `${serviceName}-second`,
//         expiryTime: currSec,
//       },
//       'callCount',
//       incVal
//     ),
//     incrementColumn(
//       AWS,
//       'apiCallCount',
//       {
//         serviceAndDuration: `${serviceName}-minute`,
//         expiryTime: currMin,
//       },
//       'callCount',
//       incVal
//     ),
//     incrementColumn(
//       AWS,
//       'apiCallCount',
//       {
//         serviceAndDuration: `${serviceName}-hour`,
//         expiryTime: currHr,
//       },
//       'callCount',
//       incVal
//     ),
//     incrementColumn(
//       AWS,
//       'apiCallCount',
//       {
//         serviceAndDuration: `${serviceName}-day`,
//         expiryTime: currDay,
//       },
//       'callCount',
//       incVal
//     ),
//   ];
//   await Promise.all(proms);
//   return true;
// };
