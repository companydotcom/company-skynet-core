import middy from "@middy/core";
import { AWS as awsImports } from "../src/library/awsImports";
import withAwsImports from "../src/middleware/withAwsImports";
import withInputValidation from "../src/middleware/withMessageProcessing";
import withTokenValidationAndContextPrep from "../src/middleware/withTokenValidationAndContextPrep";
import withVendorConfig from "../src/middleware/withVendorConfig";
import withServiceData from "../src/middleware/withServiceData";
import withMads from "../src/middleware/withMads";
import withPrivacyScreen from "../src/middleware/withPrivacyScreen";
import { getMiddyInternal } from "../src/library/util";
// import { AWS } from '../src/library/awsImports';
import { Options } from "../src/library/sharedTypes";
// import { fetchRecordsByQuery } from '../src/library/dynamo';
import fs from "fs/promises";
import * as path from "path";
// import * as ts from 'typescript';

const middlewareToTest = [
  withInputValidation,
  withTokenValidationAndContextPrep,
  withVendorConfig,
  withServiceData,
  withMads,
  withPrivacyScreen,
] as any[];

// const coreSettings = {
//   region: 'us-east-1',
//   service: 'user-acg',
//   account: '765342366425',
//   useThrottling: false,
//   maxMessagesPerInstance: 20,
//   isBulk: false,
//   eventType: 'fetch',
// } as Options;

const sharedSkynetConfig: Options = {
  region: "us-east-1",
  service: "techsupport-asi",
  account: "765342366425",
  debugMode: true,
  isBulk: false,
  eventType: "fetch",
  maxMessagesPerInstance: 20,
};

// Prepare the event for testing

const userId = "6682e9de46e04b26a2171628";
const accountId = "760800e5-af23-453d-9d5b-0634494eb3e4";

const sampleSQSEvent = {
  Records: [
    {
      EventSource: "aws:sns",
      EventVersion: "1.0",
      EventSubscriptionArn:
        "arn:aws:sns:us-east-1:811255529278:event-bus:a7f1d3a5-8109-4972-a4d3-5e69f7caee1a",
      body: {
        Type: "Notification",
        MessageId: "07a72944-bda4-5820-9752-7c9a92ad84af",
        TopicArn: "arn:aws:sns:us-east-1:811255529278:event-bus",
        Subject: null,
        MessageAttributes: {
          emitter: {
            Type: "String",
            Value: "platform-events",
          },
          eventId: {
            Type: "String",
            Value: "aeab0921-0bdc-4e47-8968-c2b8c2b1a8f2",
          },
          triggerEventId: {
            Type: "String",
            Value: "747099bd-48be-42ce-81e1-de80a7212713",
          },
          entity: {
            Type: "String",
            Value: "tile",
          },
          entityId: {
            Type: "String",
            Value: "abc123",
          },
          operation: {
            Type: "String",
            Value: "C",
          },
          status: {
            Type: "String",
            Value: "trigger",
          },
          eventType: {
            Type: "String",
            Value: "fetch",
          },
        },
        Message: {
          payload: {},
          internalMicroAppData: {
            "testINternalMicroAppData": {
              test: "test",
            },
          },
          context: {
            token:
              "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdkWFVPVnlOWGprczdSLW4wSEVhRiJ9.eyJodHRwczovL2NvbXBhbnkuY29tL3VzZXJfYXV0aG9yaXphdGlvbiI6eyJncm91cHMiOlsiU291cmNlOmNvbXBhbnkiLCJBY2NvdW50Ojc2MDgwMGU1LWFmMjMtNDUzZC05ZDViLTA2MzQ0OTRlYjNlNCJdLCJsb2dpbnNDb3VudCI6NSwicm9sZXMiOlsiYWRtaW4iXSwidXNlcnNJblNjb3BlIjpbImF1dGgwfDY2ODJlOWRlNDZlMDRiMjZhMjE3MTYyOCJdfSwiaXNzIjoiaHR0cHM6Ly9pZC1kZXYuY29tcGFueS1jb3JwLmNvbS8iLCJzdWIiOiJhdXRoMHw2NjgyZTlkZTQ2ZTA0YjI2YTIxNzE2MjgiLCJhdWQiOlsiaHR0cHM6Ly9jb21wYW55LWNvcnAtZGV2eC5hdXRoMC5jb20vYXBpL3YyLyIsImh0dHBzOi8vY29tcGFueS1jb3JwLWRldnguYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTcyMTg5NjMyMSwiZXhwIjoxNzIxOTgyNzIxLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoidDlpVDN3cFNNM2ltVmdpQnZ6N29iMmRIT0hDWGxaR1UifQ.o2ZHfxENpnAXbztKbm_n9pEF_PHLSoJzKrZlaEtlbuyMxiEK3vyEVypLH7Z1rmy29wIDHb_aEPNRl6AN-AElRgasX52qTI65uHm9z-AjJvzMgsStjqteVOF1MzvnGeNU3owR40aAuy7FOdG51DSHNrBBsXvv_xzKE7hMEWQFN2PHy3IKSScwmy1AlUKAckrVc3IrnnKEDBm32ijYsJoykScEBY48GGE4td6xDpk2S9rQwJhTGDBYbl6vexZSjahD6hi0Q0JpAJpOnRDU2zv7rjIa7UxFw6hAPK1rZLYEJYT_kTILotegBThyQZSczD0DKHZek5pJfu_-jl2IBUvPCw",
            user: {
              userId,
              accountId,
            },
            account: {},
            product: {},
            tile: {},
          },
          metadata: {
            eventType: "/* EVENT NAME */",
            tileId: "tile123",
          },
        },
      },
    },
  ],
};

const test = async (event: any) => {
  const handler = (data: any) => {
    console.log('INTERIOR DATA', JSON.stringify(data, null, 4));
    return data.map((m: any) => ({ ...m, workerResp: { res: "hello world" } }));
  };

  const getWorkerFilePath = () => {
    // const baseDir = process.env.NODE_ENV === 'development' ? __dirname : path.join(__dirname, '../src');
    return path.resolve(
      path.join(__dirname, "../../tests", "workers", "fetchWorker.ts")
    );
  };
  const workerFilePath = getWorkerFilePath();
  // const workerFilePath = `./workers/fetchWorker.ts`;
  const middifiedHandler = middy(handler);
  const workerFileData = await fs.readFile(workerFilePath, "utf8");
  middifiedHandler.use(withAwsImports(awsImports, workerFileData));
  middifiedHandler.use(middlewareToTest[0](sharedSkynetConfig));
  middifiedHandler.use(middlewareToTest[1](sharedSkynetConfig));
  middifiedHandler.use(middlewareToTest[2](sharedSkynetConfig));
  middifiedHandler.use(middlewareToTest[3](sharedSkynetConfig));
  middifiedHandler.use(middlewareToTest[4](sharedSkynetConfig));
  middifiedHandler.use(middlewareToTest[5](sharedSkynetConfig));
  middifiedHandler.use({
    before: async (request) => {
      console.log(
        "RUNNING AFTER SUCCESSFUL CONTEXT PREP",
        JSON.stringify(request, null, 4)
      );
      const context = await getMiddyInternal(request, ["context"]);
      console.log("context should be printed here");
      console.log("CONTEXT - ", JSON.stringify(context, null, 4));
    },
  });

  await middifiedHandler(event, {} as any, () => {
    console.log("did this work");
  });
};

const run = async () => {
  try {
    console.log("RUNNING GOOD EVENT");
    await test(sampleSQSEvent);
  } catch (err) {
    console.log("This should not have erred", err);
  }
};

run();
