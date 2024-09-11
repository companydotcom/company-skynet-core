import { SQSClient } from '@aws-sdk/client-sqs';

interface MessageAttributes {
  [key: string]: {
    DataType: string;
    StringValue: string;
  };
}

interface FetchWorkerParams {
  message: any;
  attributes: MessageAttributes;
  serviceConfigData: any;
  serviceAccountData: any;
  serviceUserData: any;
  internalMicroAppData: any;
  sharedMicroAppData: any;
}

export default async ({
  message,
  attributes,
  serviceConfigData,
  serviceAccountData,
  serviceUserData,
  internalMicroAppData,
  sharedMicroAppData,
}: FetchWorkerParams) => {
  console.log('fetchWorker: INFO: Received a call to work.');
  console.log(`message => ${JSON.stringify(message, null, 2)})`);
  console.log(`attributes => ${JSON.stringify(attributes, null, 2)}`);
  console.log(
    `serviceConfigData => ${JSON.stringify(serviceConfigData, null, 4)}`,
  );
  console.log(
    `serviceAccountData => ${JSON.stringify(serviceAccountData, null, 4)}`,
  );
  console.log(`serviceUserData => ${JSON.stringify(serviceUserData, null, 4)}`);
  console.log(
    `internalMicroAppData => ${JSON.stringify(internalMicroAppData, null, 4)}`,
  );
  console.log(
    `sharedMicroAppData => ${JSON.stringify(sharedMicroAppData, null, 4)}`,
  );

  if (
    typeof message.metadata === 'undefined' ||
    typeof message.metadata.eventType === 'undefined'
  ) {
    throw new Error(
      'Message did not have the required parameter metadata or parameter eventType within metadata',
    );
  }

  switch (message.metadata.eventType) {
    case 'testCase':
      console.log('SQSClient - ', SQSClient);
      return {
        res: 'This is a test response from the fetch worker',
      };
    default:
      throw new Error(
        `User is not of a source ${message.context.user.source} this service can work on.`,
      );
  }
};
