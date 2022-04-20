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

  const { images } = JSON.parse(event.body);

  // No keys passed to the function's body, return 404
  if (images.length === 0) {
    const result = {
      status: 404,
      code: "not-found",
      message: "No image passed for removal",
    };
    console.warn(result);
    const message = await JSON.stringify(result, 2, null);
    const response = parseResponse(context, message, result.status);
    return response;
  }

  // Check if the image already exists under the required path
  // If exists return a conflict message without attemting to upload
  let exists = [];
  for (const name of images) {
    const filename = decodeURI(name);
    const currentKey = `${key}${key === "" ? "" : "/"}${filename}`;
    const exist = await getMetadata(bucket, currentKey);
    if (exist) exists.push(filename);
  }

  if (exists.length !== images.length) {
    const result = {
      status: 404,
      code: "not-found",
      message: `Images [ ${images
        .filter((image) => !exists.includes(image))
        .toString()
        .replace(/,/g, ", ")} ] don't exist under the requested path /${key}`,
    };
    console.warn(result);
    const message = await JSON.stringify(result, 2, null);
    const response = parseResponse(context, message, result.status);
    return response;
  }

  try {
    // Delete imagese and return a message
    for (const image of images) {
      const filename = decodeURI(image);
      const currentKey = `${key}${key === "" ? "" : "/"}${filename}`;
      await removeImage(bucket, currentKey);
    }
    const result = {
      status: 200,
      code: "success",
      message: "Images removed successfully!",
    };
    console.log(result);
    const message = await JSON.stringify(result);
    const response = parseResponse(context, message);
    return response;
  } catch (err) {
    console.error(err);
    const parsedError = await JSON.stringify(
      Object.assign(err, { message: "Images removal failed!" }),
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
    "Access-Control-Allow-Origin": "*", // TODO: Can be changed with https://consumer-domain.com
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
