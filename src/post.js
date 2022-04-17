const { beforeHandleRequest } = require("./helpers/security");
const { getSetting } = require("./helpers/settings");
const { uploadImage, getMetadata, parseImageKey } = require("./helpers/bucket");
const {
  parseMultipartBoundary,
  parseMultipartBody,
} = require("./helpers/utils");
const buffer = require("buffer");

exports.handler = async (event, context) => {
  const beforeHandle = beforeHandleRequest(event);

  // Mandatory security parameter is not passed
  if (!beforeHandle.allowed) {
    if (context && context.succeed) {
      context.succeed(beforeHandle.response);
    }
    return beforeHandle.response;
  }

  // ? Due to Lambda-Proxy Integration, API Gateway encodes body's request in base64
  // ? If the flag is true we parse it back to a Binary string, need to bypass this somehow...
  // ? https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings-workflow.html
  const parsedBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("binary")
    : event.body;

  // Get the Boundry for parsing the invidual request images
  const boundary = parseMultipartBoundary(event.headers["content-type"]);
  const bucket = getSetting("SOURCE_BUCKET");
  const key = parseImageKey(event.path);

  // Parse the Body to get the images along with the metadata.
  // If the parsing returns an empty Object then bypass.
  const images = parseMultipartBody(parsedBody, boundary);
  if (Object.keys(images).length === 0) {
    const result = {
      status: 400,
      code: "internal-error",
      message: "Malformed or missing incoming data",
    };
    console.warn(result);
    const message = await JSON.stringify(result, 2, null);
    const response = parseResponse(context, message, result.status);
    return response;
  }

  // Check if any of the image requested already exists under the required path
  // If any exist return a conflict message without attemting to upload any
  let exists = [];
  for (const image of images.files) {
    const filename = decodeURI(image.filename);
    const currentKey = `${key}${key === "" ? "" : "/"}${filename}`;
    const exist = await getMetadata(bucket, currentKey);
    if (exist) exists.push(filename);
  }
  if (exists.length !== 0) {
    const result = {
      status: 409,
      code: "already-exists",
      message: `Images [ ${exists
        .toString()
        .replace(
          /,/g,
          ", "
        )} ] already exist within the requested path /${key}`,
    };
    console.warn(result);
    const message = await JSON.stringify(result, 2, null);
    const response = parseResponse(context, message, result.status);
    return response;
  }

  let ETags = [];

  try {
    // Build the object of properties to pass further to the upload function on Amazon S3
    // for each image that has been parsed from the multipart data
    for (const image of images.files) {
      const filename = decodeURI(image.filename);
      const currentKey = `${key}${key === "" ? "" : "/"}${filename}`;
      const body = buffer.transcode(Buffer.from(image.data), "utf8", "binary");

      const imageObject = {
        Bucket: bucket,
        Key: currentKey,
        Body: body,
        ContentType: image["Content-Type"],
        ContentLength: Buffer.byteLength(body),
      };
      const { ETag } = await uploadImage(imageObject);
      ETags.push({
        link: `https://${bucket}/${currentKey}`,
        ETag: ETag.replace(/"/g, ""), // Removes double quotes returned from AWS S3 API
      });
    }
    const result = {
      status: 200,
      code: "success",
      message: "Images uploaded successfully!",
      ETags: ETags,
    };
    console.log(result);
    const message = await JSON.stringify(result, 2, null);
    const response = parseResponse(context, message);
    return response;
  } catch (err) {
    console.error(err);
    const parsedError = await JSON.stringify(
      Object.assign(err, { message: "Images upload failed!" }),
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
    "Access-Control-Allow-Methods": "POST,OPTIONS",
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
