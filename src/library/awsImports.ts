import * as DynamoDBClient from '@aws-sdk/client-dynamodb';
import * as DynamoDBUtils from '@aws-sdk/util-dynamodb';
import * as DynamoDBLib from '@aws-sdk/lib-dynamodb';
import * as SNSClient from '@aws-sdk/client-sns';
import * as SSMClient from '@aws-sdk/client-ssm';
// import * as SQSClient from '@aws-sdk/client-sqs';
import * as S3Client from '@aws-sdk/client-s3';

export const AWS: { [key: string]: any } = {
  dynamoDbClient: DynamoDBClient,
  dynamoDbUtils: DynamoDBUtils,
  dynamoDbLib: DynamoDBLib,
  snsClient: SNSClient,
  ssmClient: SSMClient,
  // sqsClient: SQSClient,
  s3Client: S3Client,
};

// export const AWS: { [key: string]: any } = {
//   dynamoDbClient: require('@aws-sdk/client-dynamodb'),
//   dynamoDbUtils: require('@aws-sdk/util-dynamodb'),
//   dynamoDbLib: require('@aws-sdk/lib-dynamodb'),
//   snsClient: require('@aws-sdk/client-sns'),
//   ssmClient: require('@aws-sdk/client-ssm'),
//   sqsClient : require('@aws-sdk/client-sqs'),
//   S3Client: require('@aws-sdk/client-s3'),
//   // other AWS SDK imports will come here

// };
