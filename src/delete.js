const { beforeHandleRequest } = require("./helpers/security");
const { getSetting } = require("./helpers/settings");
const { removeImage, getMetadata, parseImageKey } = require("./helpers/bucket");

exports.handler = async (event, context) => {
  const beforeHandle = beforeHandleRequest(event);

  // Mandatory security parameter is not passed
  if (!beforeHandle.allowed) {
    if (context && context.succeed) {
      context.succeed(beforeHandle.response);
    }
    return beforeHandle.response;
  }

  const bucket = getSetting("SOURCE_BUCKET");
  const key = parseImageKey(event.path);

  // Check if the image already exists under the required path
  // If exists return a conflict message without attemting to upload
  const exists = await getMetadata(bucket, key);
  if (!exists) {
    const result = {
      status: 404,
      code: "not-found",
      message: "No image exists under the requested path",
    };
    console.warn(result);
    const message = await JSON.stringify(result, 2, null);
    const response = parseResponse(context, message, result.status);
    return response;
  }

  try {
    // Detele the image and return a message
    const removedImage = await removeImage(bucket, key);
    const result = {
      status: 200,
      code: "success",
      message: "Image removed successfully!",
    };
    console.log(result);
    const message = await JSON.stringify(result);
    const response = parseResponse(context, message);
    return response;
  } catch (err) {
    console.error(err);
    const parsedError = await JSON.stringify(
      Object.assign(err, { message: "Image removal failed!" }),
      2,
      null
    );
    const response = parseResponse(context, parsedError, err.status);
    return response;
  }
};

/**
 * Prepares a response object that can be returned from the Lambda function
 * @param {Object} context - The context from the Lambda runtime.
 * @param {String} message - A stringified object with information
 * @param {Number} status - The status of the response, defaults to 200
 * @return {Object} - The response object.
 */
const parseResponse = (context, message, status = 200) => {
  const timenow = new Date();
  const headers = {
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Origin": "*", // TODO: Can be changed with https://domain.com
    "Last-Modified": timenow.toString(),
    "Content-Type": "application/json",
  };

  const response = {
    statusCode: status,
    headers: headers,
    body: message,
    isBase64Encoded: false,
  };

  if (context && context.succeed) {
    context.succeed(response);
  }
  return response;
};
