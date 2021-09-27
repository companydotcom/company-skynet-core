import { globalAgent } from 'http';
import { camelCase } from 'lodash';

/**
 * @description Attempt to JSON.parse input value. If parse fails, return original value.
 * @param {any} v
 * @returns {any}
 */
export const parseJson = (v) => {
  try {
    return JSON.parse(v);
  } catch (err) {
    return v;
  }
};

export const deepParseJson = (jsonString) => {
  if (typeof jsonString === 'string') {
    if (!isNaN(Number(jsonString))) {
      return jsonString;
    }
    try {
      return deepParseJson(JSON.parse(jsonString));
    } catch (err) {
      return jsonString;
    }
  } else if (Array.isArray(jsonString)) {
    return jsonString.map((val) => deepParseJson(val));
  } else if (typeof jsonString === 'object' && jsonString !== null) {
    return Object.keys(jsonString).reduce((obj, key) => {
      obj[key] = deepParseJson(jsonString[key]);
      return obj;
    }, {});
  } else {
    return jsonString;
  }
};

/**
 * Returns the string equivalent meaning for given HTTP status code
 * @param {Number} code
 */
const getCodeStatus = (code) => {
  switch (code) {
    case 200:
      return 'OK';
    case 201:
      return 'Created';
    case 400:
      return 'Bad Request';
    case 500:
      return 'Internal Server Error';
    default:
      return undefined;
  }
};

/**
 * @typedef {Object} LambdaProxyIntegrationResponse
 * @property {number} statusCode
 * @property {string} body
 */

/**
 * @description Format HTTP lambda's input, result, and response code to be comliant with Lambda proxy integration
 * @param {number} code
 * @param {*} input
 * @param {*} result
 * @returns {LambdaProxyIntegrationResponse}
 */
export const formatHttpResponse = (code, input, result) => {
  const status = getCodeStatus(code);
  const resp = `HTTP Resp: ${code}${status ? ` - ${status}` : ''}`;
  let resultObj = {};
  if (result instanceof Error) {
    resultObj.error = result.toString();
  } else if (typeof result === 'object') {
    resultObj = result;
  } else {
    resultObj.message = result;
  }
  return {
    statusCode: code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      resp,
      input,
      resultObj,
    }),
  };
};

/**
 * Returns the string representation of a given object, error or string
 * @param {Object/ String/ Error} e
 * @returns {String}
 */
export const getErrorString = (e) => {
  if (e instanceof Error) {
    return e.toString();
  }
  if (typeof e === 'object') {
    return JSON.stringify(e, null, 4);
  }
  return e;
};

/**
 * This is a higher order function to execute the given messageHandler, catch
 * errors and return a proper response
 * @param {any} params
 * @param {Function} messageHandler
 * @returns {Object}
 */
export const neverThrowError = async (params, messageHandler) => {
  const result = {
    status: 'pass',
    params,
  };
  try {
    result.workerResp = await messageHandler(params);
  } catch (e) {
    result.status = 'fail';
    result.error = getErrorString(e);
  }
  return result;
};

/**
 * Classis sleep function using async-await
 * @param {Number} s is the number of milliseconds to sleep
 */
export const sleep = async (s) =>
  new Promise((r) =>
    setTimeout(() => {
      r();
    }, s),
  );

/**
 * Checks if the given param exists in the given object
 * @param {object} obj is the object to check if the given param exists in
 * @param {string} param is the param to check if it exists in the given obj
 * @returns {Boolean}
 */
// eslint-disable-next-line max-len
export const itemExists = (obj, param) =>
  typeof obj === 'object' && obj !== null ? Object.prototype.hasOwnProperty.call(obj, param) : false;

/**
 * Filters the globalMicroAppData object based on if the service
 * is included in the readAccess array of item or not.
 * @param {Object: raw MADS} globalMicroAppData the object as is from the Account, or User tables
 * @param {String} service the service name (serverless name) of the current processing service
 * @returns a globalMicroAppData object filtered to just the data points that current service has access to
 * @abstract docs: https://bit.ly/3kdY2w9
 */
export const evaluateMadsReadAccess = (globalMicroAppData, service) => {
  let result = {};

  // * key = mads service name (ex. 'gmb-svc')
  // * value = data store array (ex. [{key: 'a', value: {}, readAccess: ['*']}, ...])
  Object.entries(globalMicroAppData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const eachMadsFiltered = value.filter(
        (dataPoint) => dataPoint.readAccess.includes(service) || dataPoint.readAccess.includes('*'),
      );

      if (eachMadsFiltered.length) {
        result[key] = eachMadsFiltered;
      }
    }
  });

  return result;
};

/**
 * Transforms a raw MADS object to readable object, without array data points, or readAccess arrays.
 * @param {Object: raw MADS} mads the object as is from the Account, User, internal-user-mads or internal-account-mads tables
 * @returns a readable MADS object.
 * @abstract docs: https://bit.ly/3kdY2w9
 */
export const transformMadsToReadFormat = (mads) => {
  let result = {};

  // * key = mads service name (ex. 'gmb-svc')
  // * value = data store array (ex. [{key: 'a', value: {}, readAccess: ['*']}, ...])
  Object.entries(mads).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const eachMadsReduced = value.reduce((acc, cur) => {
        acc[cur.key] = cur.value;
        return acc;
      }, {});

      result[key] = eachMadsReduced;
    }
  });

  return result;
};

/**
 * Finds duplicate MADS keys if any
 * @param {Object: worker response MADS} mads from the process worker response
 * @returns {string || null} Returns first duplicate key in MADS array, or null if no duplicates
 */
export const findDuplicateMadsKeys = (mads) => {
  let duplicateKey;

  const keyCount = mads.reduce((acc, cur) => {
    acc[cur.key] = acc[cur.key] >= 0 ? acc[cur.key] + 1 : 0;
    return acc;
  }, {});

  Object.entries(keyCount).forEach(([key, value]) => {
    if (value > 0) {
      duplicateKey = key;
    }
  });

  return duplicateKey || null;
};

/**
 * Filters MADS array from the process worker response into two new array
 * global and internal
 * @param {Object: worker response MADS} mads from the process worker response
 * @returns {Array: [internalMads, globalMads]}
 */
export const filterMadsByReadAccess = (mads) => {
  const internalMads = mads.filter((item) => item.readAccess.length === 0);
  const globalMads = mads.filter((item) => item.readAccess.length > 0);

  return [internalMads, globalMads];
};
