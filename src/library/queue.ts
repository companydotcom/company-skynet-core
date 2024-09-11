import { deepParseJson } from './util';

const SAFE_MSG_FETCH_LIMIT_PER_INSTANCE = 500;
const MAX_MESSAGE_PER_BATCH = 10;
const VISIBILITY_TIMEOUT = 60 * 15;
/**
 * Convert the given SNS type attributes to simple JSON key-value pair of
 * attributes
 * @param {Object} attribs are the message attributes
 * @returns {[{String: *}]}
 */

const unmarshallMsgAttribs = (attribs: any) => {
  return Object.keys(attribs).reduce((res: any, key: any) => {
    const { Type: type, Value: value } = attribs[key];
    if (type !== 'String' && type !== 'Number') {
      res[key] = JSON.parse(value);
    } else {
      res[key] = value;
    }
    return res;
  }, {});
};

/**
 * Parse the given SQS message that contains a SNS message to its body,
 * attributes and SQS message receipt handle
 * @param {Object} message
 * @returns { msgBody: Object, msgAttribs: Object, rcptHandle: String}
 */
export const parseMsg = (message: any) => {
  let msgB = message.Body ? message.Body : message.body;
  let msgAttribs = {};
  try {
    msgB = message.Body
      ? deepParseJson(message.Body)
      : deepParseJson(message.body);
  } catch (e1) {
    console.log(
      'Error: withSqsConsumer - parseMsg: Did not get a JSON parsable message in body',
    );
    throw e1;
  }
  if (typeof msgB.MessageAttributes !== 'undefined') {
    msgAttribs = unmarshallMsgAttribs(msgB.MessageAttributes);
  }
  return {
    msgBody: msgB.Message,
    msgAttribs,
    rcptHandle: message.ReceiptHandle,
  };
};

/**
 * Send the given message to the given SQS queue
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} region is the region of AWS that this service is running in
 * @param {String} qUrl is the url of the queue to send the message to
 * @param {String} msg is the message that needs to be sent
 * @returns {*}
 */
export const sendMsg = async (
  AWS: any,
  region: string,
  qUrl: string,
  msg: any,
) => {
  console.log(
    '------------------------------3---------------------------------------',
  );
  // console.log('sendMsg - ', AWS.sqsClient);
  console.log(
    '------------------------------4---------------------------------------',
  );
  const sqs = new AWS.sqsClient.SQSClient({ region });
  console.log(
    '------------------------------5---------------------------------------',
  );
  console.log('queue url - ', qUrl);
  console.log(
    '------------------------------10---------------------------------------',
  );
  const command = new AWS.sqsClient.SendMessageCommand({
    QueueUrl: qUrl,
    MessageBody: msg,
  });
  try {
    return await sqs.send(command);
  } catch (err) {
    console.error('Error sending message to SQS:', err);
    throw err;
  }
};

/**
 * Gets messages from the given queue
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} region is the region of AWS that this service is running in
 * @param {Number} msgCountToFetch is the quantity of messages to fetch from the queue. Returned message quantity can be less than this if the messages in the queue are exhausted
 * @param {String} QueueUrl is the url of the queue from which to fetch the messages
 * @returns {[SQSMessage]}
 */
export const getMsgsFromQueue = async (
  AWS: any,
  region: string,
  msgCountToFetch: number,
  QueueUrl: string,
) => {
  console.log(`Fetching messages from SQS URL: ${QueueUrl}`);
  const sqs = new AWS.sqsClient.SQSClient({ region });
  let messages: any[] = [];
  const proms = [];
  let msgsToFetch = Math.min(
    msgCountToFetch,
    SAFE_MSG_FETCH_LIMIT_PER_INSTANCE,
  );

  while (msgsToFetch > 0) {
    const msgsToFetchThisIter = Math.min(msgsToFetch, MAX_MESSAGE_PER_BATCH);
    msgsToFetch -= msgsToFetchThisIter;
    const command = new AWS.sqsClient.ReceiveMessageCommand({
      QueueUrl,
      MaxNumberOfMessages: msgsToFetchThisIter,
      VisibilityTimeout: VISIBILITY_TIMEOUT,
    });
    proms.push(sqs.send(command));
  }
  const resps = await Promise.all(proms);
  resps.forEach((resp) => {
    if (typeof resp.Messages !== 'undefined' && resp.Messages.length > 0) {
      messages = [...messages, ...resp.Messages];
    }
  });
  return messages;
};

/**
 * Delete message from the given queue url using the given receipt handle
 * @param {object} AWS is the AWS sdk instance that needs to be passed from the handler
 * @param {string} region is the region of AWS that this service is running in
 * @param {String} QueueUrl is the url of the queue from which to delete the message
 * @param {String} ReceiptHandle is the receipt handle of the message to be deleted
 * @returns {*}
 */
export const deleteMsg = async (
  AWS: any,
  region: string,
  QueueUrl: string,
  ReceiptHandle: string,
) => {
  const sqs = new AWS.sqsClient.SQSClient({ region });
  const command = new AWS.sqsClient.DeleteMessageCommand({
    QueueUrl,
    ReceiptHandle,
  });
  try {
    return await sqs.send(command);
  } catch (err) {
    console.error('Error deleting message from SQS:', err);
  }
};
