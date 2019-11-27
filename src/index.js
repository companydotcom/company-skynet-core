import { handler as fH } from './handlers/fetch';
import { handler as dTH } from './handlers/directTransition';
import { handler as bTH } from './handlers/bulkTransition';
import { handler as sDb } from './handlers/setupDatabase';


export const fetchHandler = async (AWS, { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity }, r, s, a, b, c) => {
  return fH(AWS, { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity }, r, s, a, b, c);
};

export const directTransitionHandler = async (AWS, { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity }, r, s, a, b, c) => {
  return dTH(AWS, { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity }, r, s, a, b, c);
};

export const bulkTransitionHandler = async (AWS, { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity }, r, s, a, b, c) => {
  return bTH(AWS, { throttleLmts, safeThrottleLimit, reserveCapForDirect, retryCntForCapacity }, r, s, a, b, c);
};

export const setupDatabase = async (AWS, d, s) => {
  let data = '';
  if (typeof d === 'object') {
    data = d;
  } else {
    try {
      data = JSON.parse(d);
    } catch (e) {
      console.log('Unable to parse the database file. Please check if it is a valid JSON document.');
      return;
    }
  }
  return sDb(AWS, typeof d === 'object' ? d : JSON.parse(d), s);
};