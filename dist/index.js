module.exports=function(e){var t={};function r(o){if(t[o])return t[o].exports;var s=t[o]={i:o,l:!1,exports:{}};return e[o].call(s.exports,s,s.exports,r),s.l=!0,s.exports}return r.m=e,r.c=t,r.d=function(e,t,o){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:o})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var o=Object.create(null);if(r.r(o),Object.defineProperty(o,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var s in e)r.d(o,s,function(t){return e[t]}.bind(null,s));return o},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=2)}([function(e,t,r){"use strict";r.r(t),r.d(t,"parseJson",(function(){return o})),r.d(t,"deepParseJson",(function(){return s})),r.d(t,"formatHttpResponse",(function(){return a})),r.d(t,"getErrorString",(function(){return n})),r.d(t,"neverThrowError",(function(){return i})),r.d(t,"sleep",(function(){return c})),r.d(t,"itemExists",(function(){return l})),r.d(t,"evaluateMadsReadAccess",(function(){return u})),r.d(t,"transformMadsToReadFormat",(function(){return p})),r.d(t,"findDuplicateMadsKeys",(function(){return d})),r.d(t,"filterMadsByReadAccess",(function(){return m}));const o=e=>{try{return JSON.parse(e)}catch(t){return e}},s=e=>{if("string"!=typeof e)return Array.isArray(e)?e.map(e=>s(e)):"object"==typeof e&&null!==e?Object.keys(e).reduce((t,r)=>(t[r]=s(e[r]),t),{}):e;if(!isNaN(Number(e)))return e;try{return s(JSON.parse(e))}catch(t){return e}},a=(e,t,r)=>{const o=(e=>{switch(e){case 200:return"OK";case 201:return"Created";case 400:return"Bad Request";case 500:return"Internal Server Error";default:return}})(e),s=`HTTP Resp: ${e}${o?" - "+o:""}`;let a={};return r instanceof Error?a.error=r.toString():"object"==typeof r?a=r:a.message=r,{statusCode:e,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Credentials":!0},body:JSON.stringify({resp:s,input:t,resultObj:a})}},n=e=>e instanceof Error?e.toString():"object"==typeof e?JSON.stringify(e,null,4):e,i=async(e,t)=>{const r={status:"pass",params:e};try{r.workerResp=await t(e)}catch(e){r.status="fail",r.error=n(e)}return r},c=async e=>new Promise(t=>setTimeout(()=>{t()},e)),l=(e,t)=>"object"==typeof e&&null!==e&&Object.prototype.hasOwnProperty.call(e,t),u=(e,t)=>{let r={};return Object.entries(e).forEach(([e,o])=>{if(Array.isArray(o)){const s=o.filter(e=>e.readAccess.includes(t)||e.readAccess.includes("*"));s.length&&(r[e]=s)}}),r},p=e=>{let t={};return Object.entries(e).forEach(([e,r])=>{if(Array.isArray(r)){const o=r.reduce((e,t)=>(e[t.key]=t.value,e),{});t[e]=o}}),t},d=e=>{let t;const r=e.reduce((e,t)=>(e[t.key]=e[t.key]>=0?e[t.key]+1:0,e),{});return Object.entries(r).forEach(([e,r])=>{r>0&&(t=e)}),t||null},m=e=>[e.filter(e=>0===e.readAccess.length),e.filter(e=>e.readAccess.length>0)]},,function(e,t,r){"use strict";var o;r.r(t),r.d(t,"fetchHandler",(function(){return S})),r.d(t,"bulkFetchHandler",(function(){return k})),r.d(t,"directTransitionHandler",(function(){return N})),r.d(t,"bulkTransitionHandler",(function(){return F})),r.d(t,"webhookHandler",(function(){return T})),r.d(t,"setupDatabase",(function(){return M})),r.d(t,"httpReqHandler",(function(){return I}));var s=new Uint8Array(16);function a(){if(!o&&!(o="undefined"!=typeof crypto&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto)||"undefined"!=typeof msCrypto&&"function"==typeof msCrypto.getRandomValues&&msCrypto.getRandomValues.bind(msCrypto)))throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");return o(s)}var n=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;for(var i=function(e){return"string"==typeof e&&n.test(e)},c=[],l=0;l<256;++l)c.push((l+256).toString(16).substr(1));var u=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:0,r=(c[e[t+0]]+c[e[t+1]]+c[e[t+2]]+c[e[t+3]]+"-"+c[e[t+4]]+c[e[t+5]]+"-"+c[e[t+6]]+c[e[t+7]]+"-"+c[e[t+8]]+c[e[t+9]]+"-"+c[e[t+10]]+c[e[t+11]]+c[e[t+12]]+c[e[t+13]]+c[e[t+14]]+c[e[t+15]]).toLowerCase();if(!i(r))throw TypeError("Stringified UUID is invalid");return r};var p=function(e,t,r){var o=(e=e||{}).random||(e.rng||a)();if(o[6]=15&o[6]|64,o[8]=63&o[8]|128,t){r=r||0;for(var s=0;s<16;++s)t[r+s]=o[s];return t}return u(o)},d=r(0);const m=async(e,t,r=!1)=>{const o=new e.DynamoDB({apiVersion:"2012-08-10"});Object(d.itemExists)(t,"Limit")||(t.Limit=1e3);try{const s=await o.query(t).promise();return!0===r?!Object(d.itemExists)(s,"Items")||s.Items.length<1?{items:[],ExclusiveStartKey:void 0}:{items:s.Items.map(t=>e.DynamoDB.Converter.unmarshall(t)),ExclusiveStartKey:Object(d.itemExists)(s,"LastEvaluatedKey")?s.LastEvaluatedKey:void 0}:!Object(d.itemExists)(s,"Items")||s.Items.length<1?[]:s.Items.map(t=>e.DynamoDB.Converter.unmarshall(t))}catch(e){throw e}},y=async(e,t,r,o,s)=>{const a={TableName:t,Key:r,UpdateExpression:`ADD ${o} :val`,ExpressionAttributeValues:{":val":s}};return(new e.DynamoDB.DocumentClient).update(a).promise()},g=async(e,t,r,o=1e3)=>{const s=new e.DynamoDB({apiVersion:"2012-08-10"}),a=t.map(t=>({PutRequest:{Item:e.DynamoDB.Converter.marshall(t)}})),n=[];for(;a.length>0;)n.push(s.batchWriteItem({RequestItems:{[r]:a.splice(0,25)}}).promise());console.log(`DYNAMODB SERVICE: batchPutIntoDynamoDb: totalBulkRequestsSent: ${n.length} with each request having 25 records except the last one having ${t.length-25*(n.length-1)} records`);try{const t=(await Promise.all(n)).map(t=>Object(d.itemExists)(t,"UnprocessedItems")&&Object(d.itemExists)(t.UnprocessedItems,r)&&t.UnprocessedItems[r].length>0?t.UnprocessedItems[r].map(t=>e.DynamoDB.Converter.unmarshall(t.PutRequest.Item)):[]).reduce((e,t)=>e.concat(t));return!(t.length>0)||(await Object(d.sleep)(o),g(e,t,r,o+1e3))}catch(e){throw e}},f=e=>{if((e=>"string"==typeof e)(e))return"String";if((e=>"number"==typeof e)(e))return"Number";if((e=>Array.isArray(e))(e))return"String.Array";throw new Error(`Invalid MessageAttribute type: ${typeof e} for value ${e}. Valid types: String, Number, Array.`)},b=e=>Object.keys(e).reduce((t,r)=>{const o=e[r];if(void 0===o)return t;const s=f(o);return{...t,[r]:{DataType:s,StringValue:"String.Array"===s?JSON.stringify(o):o.toString()}}},{});var h=async(e,t,r,o={},s={})=>{const a=new e.SNS({apiVersion:"2010-03-31"});let n;try{const e={Message:JSON.stringify(r),TopicArn:t,MessageAttributes:b(o),...s};return n=await a.publish(e).promise(),console.log("SNS Publish - Success: ",JSON.stringify(e)),n}catch(e){return console.log("SNS Publish - Failure: ",e.toString()),e}};const{deepParseJson:w}=r(0),O=e=>{let t=e.Body?e.Body:e.body,r={};try{t=e.Body?w(e.Body):w(e.body)}catch(e){throw console.log("Error: withSqsConsumer - parseMsg: Did not get a JSON parsable message in body"),e}var o;return void 0!==t.MessageAttributes&&(o=t.MessageAttributes,r=Object.keys(o).reduce((e,t)=>{const{Type:r,Value:s}=o[t];return"String"!==r&&"Number"!==r?{...e,[t]:JSON.parse(s)}:{...e,[t]:s}},{})),{msgBody:t.Message,msgAttribs:r,rcptHandle:e.ReceiptHandle}},v=async(e,t,r,o)=>{console.log("Fetching messages from SQS URL: "+o);const s=new e.SQS({region:t});let a=[];const n=[];let i=r<500?r:500;for(;i>0;){const e=i<10?i:10;i-=e,n.push(s.receiveMessage({QueueUrl:o,MaxNumberOfMessages:e,VisibilityTimeout:900}).promise())}return(await Promise.all(n)).forEach(e=>{void 0!==e.Messages&&e.Messages.length>0&&(a=[...a,...e.Messages])}),a},E=async(e,t)=>(await m(e,{TableName:"Account",ExpressionAttributeNames:{"#pk":"accountId"},KeyConditionExpression:"#pk = :accId",ExpressionAttributeValues:{":accId":{S:t}}}))[0],R=async(e,t)=>(await m(e,{TableName:"User",ExpressionAttributeNames:{"#pk":"userId"},KeyConditionExpression:"#pk = :uId",ExpressionAttributeValues:{":uId":{S:t}}}))[0],D=async(e,t)=>(await m(e,{TableName:"internal-account-mads",ExpressionAttributeNames:{"#pk":"accountId"},KeyConditionExpression:"#pk = :accId",ExpressionAttributeValues:{":accId":{S:t}}}))[0],A=async(e,t)=>(await m(e,{TableName:"internal-user-mads",ExpressionAttributeNames:{"#pk":"userId"},KeyConditionExpression:"#pk = :uId",ExpressionAttributeValues:{":uId":{S:t}}}))[0],C=async(e,t,r,o,{msgBody:s,msgAttribs:a,rcptHandle:n},i)=>{const c=await m(e,{TableName:"vendorConfig",ExpressionAttributeNames:{"#pk":"service"},KeyConditionExpression:"#pk = :serv",ExpressionAttributeValues:{":serv":{S:r}}});let l,u,y,f;if(Object(d.itemExists)(s,"context")&&Object(d.itemExists)(s.context,"user")&&Object(d.itemExists)(s.context.user,"userId")&&Object(d.itemExists)(s.context.user,"accountId")){const[t,r,o,a]=await Promise.all([E(e,s.context.user.accountId),R(e,s.context.user.userId),D(e,s.context.user.accountId),A(e,s.context.user.userId)]);l=t,u=r,y=o,f=a}let b={};Object(d.itemExists)(s,"context")&&(Object(d.itemExists)(l,"vendorData")&&Object(d.itemExists)(l.vendorData,r)&&(b=l.vendorData[r]),Object(d.itemExists)(s.context,"account")||(s.context.account=l));let w={};Object(d.itemExists)(s,"context")&&Object(d.itemExists)(u,"vendorData")&&Object(d.itemExists)(u.vendorData,r)&&(w=u.vendorData[r]);let O={},v={};Object(d.itemExists)(s,"context")&&(Object(d.itemExists)(s.context,"account")||(s.context.account=l),Object(d.itemExists)(l,"globalMicroAppData")&&(O.account=Object(d.transformMadsToReadFormat)(Object(d.evaluateMadsReadAccess)(l.globalMicroAppData,r))),Object(d.itemExists)(u,"globalMicroAppData")&&(O.user=Object(d.transformMadsToReadFormat)(Object(d.evaluateMadsReadAccess)(u.globalMicroAppData,r))),Object(d.itemExists)(f,r)&&(v.user=Object(d.transformMadsToReadFormat)(f[r])),Object(d.itemExists)(y,r)&&(v.account=Object(d.transformMadsToReadFormat)(y[r])));const C=await Object(d.neverThrowError)({message:s,serviceConfigData:void 0!==c&&Array.isArray(c)&&c.length>0&&void 0!==c[0].configdata?c[0].configdata:[],serviceAccountData:b,serviceUserData:w,globalMicroAppData:O,internalMicroAppData:v,attributes:a},i);if(console.log("processMessage: INFO: Result from worker is "+JSON.stringify(C,null,4)),Object(d.itemExists)(C.workerResp,"serviceAccountData")){if("object"!=typeof C.workerResp.serviceAccountData)throw new Error("Service specific user account data should be an object");console.log("Deprecation warning: serviceAccountData is being deprecated soon, please use microAppData instead."),console.log("See docs for more info: https://bit.ly/3kdY2w9"),Object(d.itemExists)(l,"vendorData")||(l.vendorData={}),Object(d.itemExists)(l.vendorData,r)||(l.vendorData[r]={}),l.vendorData[r]={...l.vendorData[r],...C.workerResp.serviceAccountData},await g(e,[l],"Account")}if(Object(d.itemExists)(C.workerResp,"serviceUserData")){if("object"!=typeof C.workerResp.serviceUserData)throw new Error("Service specific user data should be an object");console.log("Deprecation warning: serviceUserData is being deprecated soon, please use microAppData instead."),console.log("See docs for more info: https://bit.ly/3kdY2w9"),Object(d.itemExists)(u,"vendorData")||(u.vendorData={}),Object(d.itemExists)(u.vendorData,r)||(u.vendorData[r]={}),u.vendorData[r]={...u.vendorData[r],...C.workerResp.serviceUserData},await g(e,[u],"User")}if(y={},f={},Object(d.itemExists)(u,"globalMicroAppData")||(u.globalMicroAppData={}),Object(d.itemExists)(l,"globalMicroAppData")||(l.globalMicroAppData={}),Object(d.itemExists)(u.globalMicroAppData,r)||(u.globalMicroAppData[r]=[]),Object(d.itemExists)(l.globalMicroAppData,r)||(l.globalMicroAppData[r]=[]),Object(d.itemExists)(f,r)||(f[r]=[]),Object(d.itemExists)(y,r)||(y[r]=[]),Object(d.itemExists)(C.workerResp,"microAppData")&&Object(d.itemExists)(C.workerResp.microAppData.user)){const{user:t}=C.workerResp.microAppData;if(!Array.isArray(t))throw new Error("Worker response in user microAppData must be of type Array.");t.forEach(e=>{if(!Object(d.itemExists)(e,"key")||!Object(d.itemExists)(e,"value")||!Object(d.itemExists)(e,"readAccess"))throw new Error("Missing a required key (key, value, or readAccess) in a user microAppData item.")});const o=Object(d.findDuplicateMadsKeys)(t);if(o)throw new Error(`Key: ${o} in user microAppData array is not unique. All keys in the microAppData arrays must be unique.`);const[s,a]=Object(d.filterMadsByReadAccess)(t);u.globalMicroAppData[r]=a,f[r]=s,await g(e,[u],"User"),await g(e,[f],"internal-user-mads")}if(Object(d.itemExists)(C.workerResp,"microAppData")&&Object(d.itemExists)(C.workerResp.microAppData.account)){const{account:t}=C.workerResp.microAppData;if(!Array.isArray(t))throw new Error("Worker response in account microAppData must be of type Array.");t.forEach(e=>{if(!Object(d.itemExists)(e,"key")||!Object(d.itemExists)(e,"value")||!Object(d.itemExists)(e,"readAccess"))throw new Error("Missing a required key (key, value, or readAccess) in a account microAppData item.")});const o=Object(d.findDuplicateMadsKeys)(t);if(o)throw new Error(`Key: ${o} in account microAppData array is not unique. All keys in the microAppData arrays must be unique.`);const[s,a]=Object(d.filterMadsByReadAccess)(t);l.globalMicroAppData[r]=a,y[r]=s,await g(e,[l],"Account"),await g(e,[y],"internal-account-mads")}if(Object(d.itemExists)(C.workerResp,"crmData")){if("object"!=typeof C.workerResp.crmData)throw new Error("Data going to a CRM should be an object");Object.keys(C.workerResp.crmData).length>0&&await h(e,`arn:aws:sns:${t}:${o}:event-bus`,{...s,payload:C.workerResp.crmData,metadata:{eventType:"sendFields",dateCreated:Date.now(),operationType:"update",invocationSource:r}},{...a,status:"trigger",eventType:"crm",eventId:p(),emitter:r})}let j;j=Object.prototype.hasOwnProperty.call(C,"workerResp")?Object.prototype.hasOwnProperty.call(C.workerResp,"res")?C.workerResp.res:C.workerResp:void 0;return await h(e,`arn:aws:sns:${t}:${o}:event-bus`,{...s,inputPayload:s.payload,payload:j},{...a,status:(e=>{let t=e.status;return Object.prototype.hasOwnProperty.call(e,"workerResp")&&Object.prototype.hasOwnProperty.call(e.workerResp,"extraStatus")&&(t=`${t}-${e.workerResp.extraStatus}`),t})(C),eventId:p(),emitter:r}),void 0!==n&&await(async(e,t,r,o)=>{new e.SQS({region:t}).deleteMessage({QueueUrl:r,ReceiptHandle:o}).promise()})(e,t,"transition"===a.eventType?`https://sqs.${t}.amazonaws.com/${o}/${r}-bulktq`:`https://sqs.${t}.amazonaws.com/${o}/${r}-bulkfq`,n),"fail"===C.status&&(async(e,t,r,o)=>{new e.SQS({region:t}).sendMessage({QueueUrl:r,MessageBody:o}).promise()})(e,t,`https://sqs.${t}.amazonaws.com/${o}/${r}-ldlq`,JSON.stringify({failedIn:r,body:{Message:s,MessageAttributes:a,Error:C.error}})),!0},j=async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n=!0,i=0)=>{if(i>s)return 0;i>0&&await Object(d.sleep)(1e3);const c=JSON.parse(t);if(void 0===c.day&&void 0===c.hour&&void 0===c.minute&&void 0===c.second)return 1e6;const l=!0===n?(1-o)*r:1*r,u=await(async(e,t)=>{const r=Date.now(),o=Math.floor(r/1e3)+1,s=o-o%60+60,a=s-s%3600+3600,n=a-a%86400+86400,i={TableName:"apiCallCount",ExpressionAttributeNames:{"#pk":"serviceAndDuration","#et":"expiryTime"},KeyConditionExpression:"#pk = :sd AND #et = :et"},c=[m(e,{...i,ExpressionAttributeValues:{":sd":{S:t+"-second"},":et":{N:o.toString()}}}),m(e,{...i,ExpressionAttributeValues:{":sd":{S:t+"-minute"},":et":{N:s.toString()}}}),m(e,{...i,ExpressionAttributeValues:{":sd":{S:t+"-hour"},":et":{N:a.toString()}}}),m(e,{...i,ExpressionAttributeValues:{":sd":{S:t+"-day"},":et":{N:n.toString()}}})],l=await Promise.all(c);return{second:l[0].callCount?l[0].callCount:0,minute:l[1].callCount?l[1].callCount:0,hour:l[2].callCount?l[2].callCount:0,day:l[3].callCount?l[3].callCount:0}})(e,a);let p="x";return void 0!==c.day&&(Math.floor(c.day*l-u.day)<p||"x"===p)&&(p=Math.floor((c.day-u.day)*l)),void 0!==c.hour&&(Math.floor(c.hour*l-u.hour)<p||"x"===p)&&(p=Math.floor((c.hour-u.hour)*l)),void 0!==c.minute&&(Math.floor(c.minute*l-u.minute)<p||"x"===p)&&(p=Math.floor((c.minute-u.minute)*l)),void 0!==c.second&&(Math.floor(c.second*l-u.second)<p||"x"===p)&&(p=Math.floor((c.second-u.second)*l)),p>0?p:j(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i+1)},x=async(e,t,r=1)=>{const o=Date.now(),s=Math.floor(o/1e3)+1,a=s-s%60+60,n=a-a%3600+3600,i=n-n%86400+86400,c=[y(e,"apiCallCount",{serviceAndDuration:t+"-second",expiryTime:s},"callCount",r),y(e,"apiCallCount",{serviceAndDuration:t+"-minute",expiryTime:a},"callCount",r),y(e,"apiCallCount",{serviceAndDuration:t+"-hour",expiryTime:n},"callCount",r),y(e,"apiCallCount",{serviceAndDuration:t+"-day",expiryTime:i},"callCount",r)];return await Promise.all(c),!0},S=async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>(async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>{try{if(console.log("directFetch: INFO: Input is: "+("object"==typeof c?JSON.stringify(c,null,4):c)),void 0===c.Records||1!==c.Records.length)throw new Error(`directFetch: ERROR: Lambda was wrongly triggered with ${void 0===c.Records?0:c.Records.length} records`);const p=await j(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},n,!1);console.log("directFetch: INFO: Processing event "+JSON.stringify(c.Records.length,null,4));let d=[O(c.Records[0])];if(u&&(d=await u("fetch",!1,d)),!d.length)throw new Error("directFetch: ERROR: Processing complete.  Pre-worker hook rejected message.");if(p<1)throw new Error("directFetch: ERROR: No capacity to make a call");await x(e,n);const{msgBody:m,msgAttribs:y}=d[0];return await C(e,a,n,i,{msgBody:m,msgAttribs:y},l),"directFetch: INFO: Processing complete"}catch(e){throw console.log("directFetch: ERROR: "+Object(d.getErrorString)(e)),e}})(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u),k=async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>(async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>{try{console.log("bulkFetch: INFO: Scheduled call started. Event is "+("object"==typeof c?JSON.stringify(c,null,4):c));const p=await j(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},n,!0);if(p<1)throw new Error("bulkFetch: ERROR: No capacity to make a call");const d=await v(e,a,p,`https://sqs.${a}.amazonaws.com/${i}/${n}-bulkfq`);console.log("bulkFetch: INFO: Processing event "+JSON.stringify(d.length,null,4));let m=d.map(e=>O(e));if(u&&(m=await u("fetch",!0,m)),m.length<1)return"bulkFetch: INFO: Processing complete";await x(e,n,d.length);const y=[];return m.forEach(t=>{y.push(C(e,a,n,i,t,l))}),await Promise.all(y),"bulkFetch: INFO: Processing complete"}catch(e){throw console.log("bulkFetch: ERROR: "+Object(d.getErrorString)(e)),e}})(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u),N=async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>(async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>{try{if(console.log("directTransition: INFO: Input is: "+("object"==typeof c?JSON.stringify(c,null,4):c)),void 0===c.Records||1!==c.Records.length)throw new Error(`directTransition: ERROR: Lambda was wrongly triggered with ${void 0===c.Records?0:c.Records.length} records`);const p=await j(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},n,!1);console.log("directTransition: INFO: Processing event "+JSON.stringify(c.Records.length,null,4));let d=[O(c.Records[0])];if(u&&(d=await u("fetch",!1,d)),!d.length)throw new Error("directFetch: ERROR: Processing complete.  Pre-worker hook rejected message.");if(p<1)throw new Error("directTransition: ERROR: No capacity to make a call");await x(e,n);const{msgBody:m,msgAttribs:y}=d[0];return await C(e,a,n,i,{msgBody:m,msgAttribs:y},l),"directTransition: INFO: Processing complete"}catch(e){throw console.log("directTransition: ERROR: "+Object(d.getErrorString)(e)),e}})(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u),F=async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>(async(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u)=>{try{console.log("bulkTransition: INFO: Scheduled call started. Event is "+("object"==typeof c?JSON.stringify(c,null,4):c));const p=await j(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},n,!0);if(p<1)throw new Error("bulkTransition: ERROR: No capacity to make a call");const d=await v(e,a,p,`https://sqs.${a}.amazonaws.com/${i}/${n}-bulktq`);console.log("bulkTransition: INFO: Processing event "+JSON.stringify(d.length,null,4));let m=d.map(e=>O(e));if(u&&(m=await u("transition",!0,m)),m.length<1)return"bulkTransition: INFO: Processing complete";await x(e,n,m.length);const y=[];return m.forEach(t=>{y.push(C(e,a,n,i,t,l))}),await Promise.all(y),"bulkTransition: INFO: Processing complete"}catch(e){throw console.log("bulkTransition: ERROR: "+Object(d.getErrorString)(e)),e}})(e,{throttleLmts:t,safeThrottleLimit:r,reserveCapForDirect:o,retryCntForCapacity:s},a,n,i,c,l,u),T=async(e,t,r,o,s,a,n)=>(async(e,t,r,o,s,a,n)=>{try{if(console.log("directTransition: INFO: Input is: "+("object"==typeof s?JSON.stringify(s,null,4):s)),void 0===s.Records||1!==s.Records.length)throw new Error(`directTransition: ERROR: Lambda was wrongly triggered with ${void 0===s.Records?0:s.Records.length} records`);console.log("webhook: INFO: Processing event "+JSON.stringify(s.Records.length,null,4));let i=[O(s.Records[0])];if(n&&(i=await n("webhook",!1,i)),!i.length)throw new Error("directFetch: ERROR: Processing complete.  Pre-worker hook rejected message.");const{msgBody:c,msgAttribs:l}=i[0];return await C(e,t,r,o,{msgBody:c,msgAttribs:l},a),"directTransition: INFO: Processing complete"}catch(e){throw console.log("directTransition: ERROR: "+Object(d.getErrorString)(e)),e}})(e,t,r,o,s,a,n),M=async(e,t,r)=>{let o="";if("object"==typeof t)o=t;else try{o=JSON.parse(t)}catch(e){return void console.log("Unable to parse the database file. Please check if it is a valid JSON document.")}return(async(e,t,r)=>{try{const o={service:r,configdata:t};return console.log("Data being sent "+JSON.stringify([o],null,4)),await g(e,[o],"vendorConfig"),console.log("Database has been setup successfully"),"Database has been setup successfully"}catch(e){throw console.log("bulkTransition: ERROR: "+Object(d.getErrorString)(e)),e}})(e,o,r)},I=async(e,t,r,o,s,a)=>(async(e,t,r,o,s,a)=>{try{console.log("getpostHttp: INFO: Input is: "+("object"==typeof a?JSON.stringify(a,null,4):a));const n="object"==typeof a?a:JSON.parse(a),i=n.body,c=n.pathParameters,l="undefined"!==n.queryStringParameters?n.queryStringParameters:{};return await h(e,`arn:aws:sns:${t}:${o}:event-bus`,{payload:{...c,...i,...l},context:null,metadata:{eventType:c.eventType}},{status:"trigger",operation:"fetch"===c.operation?"R":"C",entity:"product",entityId:s,eventId:p(),emitter:r,eventType:c.operation}),{statusCode:200,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Credentials":!0},body:JSON.stringify({status:"getpostHttp: INFO: Request accepted and queued",input:a})}}catch(e){return console.log("getpostHttp: ERROR: "+Object(d.getErrorString)(e)),{statusCode:500,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Credentials":!0},body:JSON.stringify({status:`getpostHttp: ERROR: We encountered an error. Please quote TS${Date.now()} as reference id for further assistance`,input:a})}}})(e,t,r,o,s,a)}]);