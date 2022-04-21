const { beforeHandleRequest } = require("./helpers/security");
const { getSetting } = require("./helpers/settings");
const { listImages } = require("./helpers/bucket");

exports.handler = async (event, context) => {
  const beforeHandle = beforeHandleRequest(event);

  // Mandatory security parameter is not passed
  if (!beforeHandle.allowed) {
    if (context && context.succeed) {
      context.succeed(beforeHandle.response);
    }
    return beforeHandle.response;
  }

  try {
    // Attempt to retrieve the requested image on S3 from the request path
    const bucket = getSetting("SOURCE_BUCKET");
    const { Contents } = await listImages(bucket);
    for (const image of Contents) {
      image.ETag = image.ETag.replace(/"/g, "");
    }
    const images = await JSON.stringify(Contents, 2, null);

    const response = parseResponse(context, images);
    return response;
  } catch (err) {
    console.error(err);
    const parsedError = await JSON.stringify(err, 2, null);
    if (parsedError === "{}") {
      console.error("EMPTY");
    }
    const response = parseResponse(context, parsedError, err.status);
    return response;
  }
};

/**
 * Prepares a response object that can be returned from the Lambda function
 * @param {Object} context - The context from the Lambda runtime.
 * @param {Object} list - The stringified list of images within a specified S3 Bucket
 * @param {Number} status - The status of the response, defaults to 200
 * @return {Object} - The response object.
 */
const parseResponse = (context, list, status = 200) => {
  const timenow = new Date();
  const headers = {
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Origin": "*", // TODO: Can be changed with https://consumer-domain.com
    "Last-Modified": timenow.toString(),
    "Content-Type": "application/json",
  };

  const response = {
    statusCode: status,
    headers: headers,
    body: list,
    isBase64Encoded: false,
  };

  if (context && context.succeed) {
    context.succeed(response);
  }
  return response;
};
