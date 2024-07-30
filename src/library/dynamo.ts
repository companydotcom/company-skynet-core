// import { unmarshall } from "@aws-sdk/util-dynamodb";
// import AWSXRay from 'aws-xray-sdk';
// import { DynamoDBClient } from '@aws-sdk/client-dynamodb;

import { Options } from './sharedTypes';

// const ddb = AWSXRay.captureAWSv3Client(new DynamoDBClient({ region: "region" }));

export interface QueryObject {
  TableName: string;
  Limit?: number;
  IndexName?: string;
  KeyConditionExpression: string;
  FilterExpression?: string;
  ExpressionAttributeValues: { [key: string]: any };
  ExpressionAttributeNames?: { [key: string]: string };
}

interface FetchRecordsByQueryResultWithItems {
  items: any[];
  exclusiveStartKey?: any;
}

type FetchRecordsByQueryResult = FetchRecordsByQueryResultWithItems | any[];

const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const incrementColumn = async (
  AWS: any,
  options: Options,
  tName: string,
  srchParams: any,
  colName: string,
  incVal = 1,
) => {
  const client = new AWS.dynamoDbClient.DynamoDBClient({
    region: options.region,
  });
  const params: any = {
    TableName: tName,
    Key: srchParams,
    UpdateExpression: `ADD ${colName} :val`,
    ExpressionAttributeValues: {
      ':val': incVal,
    },
  };
  console.log('params - ', JSON.stringify(params, null, 4));
  const command = new AWS.dynamoDbLib.UpdateCommand(params);
  console.log('----------------------------');
  return client.send(command);
};

export const fetchRecordsByQuery = async (
  AWS: any,
  skynetConfig: any,
  queryObject: QueryObject,
  paginate: boolean = false,
): Promise<FetchRecordsByQueryResult | any> => {
  console.log('queryObject - ', JSON.stringify(queryObject, null, 4));
  // console.log('process.env.region - ', skynetConfig.region);
  const dynamodb = new AWS.dynamoDbClient.DynamoDBClient({
    region: skynetConfig.region,
  });
  // console.log("Query =>", JSON.stringify(queryObject, null, 4));
  // Add safe fetch limit if one is not set
  if (!queryObject.hasOwnProperty('Limit')) {
    queryObject.Limit = 1000;
  }

  try {
    const command = new AWS.dynamoDbClient.QueryCommand(queryObject);
    const queryResult = await dynamodb.send(command);
    // console.log("RESULT =>", JSON.stringify(queryResult, null, 4));
    if (paginate === true) {
      if (!queryResult.Items || queryResult.Items.length < 1) {
        return { items: [], exclusiveStartKey: undefined };
      }

      return {
        items: queryResult.Items.map((item: any) =>
          AWS.dynamoDbUtils.unmarshall(item),
        ),
        exclusiveStartKey: queryResult.hasOwnProperty('LastEvaluatedKey')
          ? queryResult.LastEvaluatedKey
          : undefined,
      };
    }

    if (!queryResult.Items || queryResult.Items.length < 1) {
      return [];
    }
    // Convert DynamoDb style objects to simple JavaScript objects
    return queryResult.Items.map((item: any) =>
      AWS.dynamoDbUtils.unmarshall(item),
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// // export async function batchFetchFromDynamoDb(
// //   records: any[],
// //   tableName: string
// // ): Promise<any> {
// //   const preparedRecords = records.map((record) => {
// //     return marshall(record);
// //   });

// //   const params = {
// //     RequestItems: {
// //       [tableName]: {
// //         Keys: preparedRecords,
// //       },
// //     },
// //   };

// //   try {
// //     const command = new BatchGetItemCommand(params);
// //     const result = await dynamodb.send(command);
// //     console.log("result - ", JSON.stringify(result, null, 4));
// //     return result;
// //   } catch (err) {
// //     console.log("Error in fetching from table - ", err.toString());
// //     throw err;
// //   }
// // }

export async function batchPutIntoDynamoDb(
  AWS: any,
  options: any,
  records: any[],
  tableName: string,
  backoffTime = 1000,
): Promise<any> {
  const dynamodb = new AWS.dynamoDbClient.DynamoDBClient({
    region: options.region,
  });
  const preparedRecords = records.map((record) => {
    return {
      PutRequest: {
        Item: AWS.dynamoDbUtils.marshall(record, {
          removeUndefinedValues: true,
        }),
      },
    };
  });

  const bulkRequests = [];

  while (preparedRecords.length > 0) {
    bulkRequests.push(
      new AWS.dynamoDbClient.BatchWriteItemCommand({
        RequestItems: {
          [tableName]: preparedRecords.splice(0, 25),
        },
      }),
    );
  }

  console.log(
    `DYNAMODB SERVICE: batchPutIntoDynamoDb: totalBulkRequestsSent: ${
      bulkRequests.length
    } with each request having 25 records except the last one having ${
      records.length - 25 * (bulkRequests.length - 1)
    } records`,
  );

  try {
    const results: any = await Promise.all(
      bulkRequests.map((command) => dynamodb.send(command)),
    );
    console.log('results - ', JSON.stringify(results, null, 4));
    const unprocessedRecords: any = results
      .map((result: any) => {
        if (
          result.hasOwnProperty('UnprocessedItems') &&
          result.UnprocessedItems.hasOwnProperty(tableName) &&
          result.UnprocessedItems[tableName].length > 0
        ) {
          return result.UnprocessedItems[tableName].map((unprocessedRec: any) =>
            AWS.dynamoDbUtils.unmarshall(unprocessedRec.PutRequest.Item),
          );
        }
        return [];
      })
      .reduce((output: any, currentArray: any) => output.concat(currentArray));

    if (unprocessedRecords.length > 0) {
      await sleep(backoffTime);
      return batchPutIntoDynamoDb(
        AWS,
        options,
        unprocessedRecords,
        tableName,
        backoffTime + 1000,
      );
    }

    return {
      unprocessedRecords: [],
      success: true,
    };
  } catch (err: any) {
    console.log('Error in inserting to table - ', err.toString());
    throw err;
  }
}

// export const deleteItemByKeys = async (tableName: string, partitionKeyName: string, partitionKeyValue: string, sortKeyName?: string, sortKeyValue?: string) => {
//   const key: AWS.DynamoDB.Key = {
//     [partitionKeyName]: { S: partitionKeyValue },
//   };

//   if (sortKeyName && sortKeyValue) {
//     key[sortKeyName] = { S: sortKeyValue };
//   }

//   const params: any = {
//     TableName: tableName,
//     Key: key,
//   };

//   try {
//     const command = await new DeleteItemCommand(params);
//     const response = await dynamodb.send(command);
//     console.log('response from delete item - ', JSON.stringify(response, null, 4));
//     console.log(`Item with partition key ${partitionKeyName}=${partitionKeyValue} and sort key ${sortKeyName}=${sortKeyValue} deleted from table ${tableName}.`);
//   } catch (err) {
//     console.error('Error deleting item:', err);
//     throw err;
//   }
// };

// export const putItemIntoDynamoDB = async(params: PutItemInput) => {
//   try {
//     // Put the item into DynamoDB
//     const query = new PutItemCommand(params);
//     const response = await dynamodb.send(query);
//     console.log('PutItem response:', response);
//   } catch (error) {
//     console.error('Error putting item:', error);
//     throw error;
//   }
// }

// export const fetchCountQuery = async (queryObject: QueryObject) => {
//   try {
//     const command = new QueryCommand(queryObject);
//     const queryResult = await dynamodb.send(command);
//     return queryResult.Count;
//   } catch (err) {
//     console.error("err try=>", err);
//     throw err;
//   }
// };
