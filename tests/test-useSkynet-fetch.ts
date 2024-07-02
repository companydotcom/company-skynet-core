// import withAwsImports from '../src/middleware/withAwsImports';
// import middy from '@middy/core';
// import { Options } from '../src/library/sharedTypes';
// import { getMiddyInternal } from '../src/library/util';
// import { useSkynet, CoreSkynetConfig} from '../src/index';
// import { promises as fs } from 'fs';
// // import fMsgHandler from './workers/fetchWorker';

// // const AWS = {
// //   dynamoDbClient,
// //   dynamoDbUtils
// // }
// // // import { CoreSkynetConfig } from "../src/library/sharedTypes";

// // // const userId = '60ee01f8885a9700717e8d8e';
// // // const accountId = 'abc3d3d7-61ef-4635-806c-e54016ad7dce';

// // // const middlewareToTest = [withContextPrep];

// const coreSettings: CoreSkynetConfig = {
//   // dynamodb,
//   region: 'us-east-1',
//   service: 'test-service',
//   account: '765342366425',
//   useThrottling: false,
//   maxMessagesPerInstance: 20,
//   isBulk: false,
//   eventType: 'fetch',
// } as CoreSkynetConfig;

// const test = async (event: any) => {


//   const handler = async (data: any) => {
//     // console.log('INTERIOR DATA', JSON.stringify(dynamoDbClient, null, 4));
//     const workerFileData = await fs.readFile('./workers/fetchWorker.ts', 'utf8');
//     return data.map((m: any) => useSkynet(
//       coreSettings,
//       m,
//       workerFileData,
//     ));
//   };

//   const middifiedHandler = middy(handler);
  

//   await middifiedHandler(event, {} as any, {} as any);
// };

// const sampleSkynetMessages = [
//   {
//     "EventSource": "aws:sns",
//     "EventVersion": "1.0",
//     "EventSubscriptionArn": "arn:aws:sns:us-east-1:254150672415:event-bus:a7f1d3a5-8109-4972-a4d3-5e69f7caee1a",
//     "body": {
//       "Type": "Notification",
//       "MessageId": "07a72944-bda4-5820-9752-7c9a92ad84af",
//       "TopicArn": "arn:aws:sns:us-east-1:254150672415:event-bus",
//       "Subject": null,
//       "MessageAttributes": {
//         "emitter": {
//           "Type": "String",
//           "Value": "platform-events"
//         },
//         "eventId": {
//           "Type": "String",
//           "Value": "aeab0921-0bdc-4e47-8968-c2b8c2b1a8f2"
//         },
//         "triggerEventId": {
//           "Type": "String",
//           "Value": "747099bd-48be-42ce-81e1-de80a7212713"
//         },
//         "entity": {
//           "Type": "String",
//           "Value": "tile"
//         },
//         "entityId": {
//           "Type": "String",
//           "Value": "user-acg"
//         },
//         "operation": {
//           "Type": "String",
//           "Value": "C"
//         },
//         "status": {
//           "Type": "String",
//           "Value": "trigger"
//         }
//       },
//       "Message": {
//         "context": {
//           "authorization": "",
//           "user": {
//             "userId": "6332a2f75bafd02fb95e5c22",
//             "accountId": "bf6318f2-6d0b-4703-9c53-e776f04b3957",
//             "source": "company"
//           },
//           "account": {
//             "accountId": "524944eb-00f2-4fde-8d0f-b0e542ea60a0"
//           },
//           "product": {},
//           "tile": {}
//         },
//         "metadata": {
//           "eventType": "getUserProfile",
//           "tileId": "user-acg",
//           "stateCurrent": "",
//           "statePrevious": ""
//         }
//       }
//     }
//   },
// ];

// // const sampleBadEvent = {
// //   hello: 'world',
// // };

// const run = async () => {
//   try {
//     console.log('RUNNING GOOD EVENT');
//     await test(sampleSkynetMessages);
//   } catch (err) {
//     console.log('This should not have erred', err);
//   }
// };

// run();
