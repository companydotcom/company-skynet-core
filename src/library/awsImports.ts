export const AWS: { [key: string]: any } = {
  dynamoDbClient: require('@aws-sdk/client-dynamodb'),
  dynamoDbUtils: require('@aws-sdk/util-dynamodb'),
  dynamoDbLib: require('@aws-sdk/lib-dynamodb'),
  snsClient: require('@aws-sdk/client-sns'),
  ssmClient: require('@aws-sdk/client-ssm'),
  sqsClient: require('@aws-sdk/client-sqs'),
  S3ClientClient: require('@aws-sdk/client-s3'),
  // other AWS SDK imports will come here
  
};