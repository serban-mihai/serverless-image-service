const { beforeHandleRequest } = require("./helpers/security");
const { getSetting } = require("./helpers/settings");
const { getOriginalImage, parseImageKey } = require("./helpers/bucket");
const { parseQueryParams } = require("./helpers/queryParams");
const sharp = require("sharp");

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
    const path = parseImageKey(event.path);
    const originalImage = await getOriginalImage(bucket, path);

    // TODO: Find a way to serve requests without query parameters directly
    // TODO: from S3, avoiding useless Lambda triggers
    // There is no query param for image manipulation, return the original image
    if (!event.queryStringParameters) {
      const response = parseResponse(context, originalImage);
      return response;
    }

    // Query params detected, making transforms over the original image
    const sharpObject = sharp(originalImage.Body);
    const metadata = await sharpObject.metadata();

    // Filter, sanitize and parse incoming query params
    const { edits, options } = parseQueryParams(
      event.queryStringParameters,
      metadata
    );
    const { resize, operations, color, channel, compositing, output } = edits;

    // ? Resizing and Output
    // Applying resize, original metadata for rotation and converting to a custom format
    sharpObject
      .resize(resize.w, resize.h, { withoutEnlargement: true })
      .withMetadata()
      .toFormat(output.fm, options);

    // ? Image Operations
    // TODO:
    if (operations.r) sharpObject.rotate(operations.r);
    if (operations.flip) sharpObject.flip();
    if (operations.flop) sharpObject.flop();
    if (operations.af)
      sharpObject.affine(operations.af, {
        background: operations.afbg,
        interpolator: sharp.interpolators[operations.afi],
      });
    if (operations.sh) sharpObject.sharpen(operations.sh);
    if (operations.md) sharpObject.median(operations.md);
    if (operations.bl) sharpObject.blur(operations.bl);
    if (operations.fl) sharpObject.flatten({ background: operations.fl });
    if (operations.gm)
      operations.gm.length === 1
        ? sharpObject.gamma(operations.gm[0])
        : sharpObject.gamma(operations.gm[0], operations.gm[1]);
    if (operations.ng) sharpObject.negate({ alpha: operations.ng });
    if (operations.nr) sharpObject.normalize(operations.nr);
    if (operations.cl) sharpObject.clahe(operations.cl);

    // ? Color Manipulation
    // TODO:

    // ? Channel Manipulation
    // TODO:

    // ? Compositing
    // If the Watermark param is set, apply it over the image along with the gravity position
    if (compositing.wm)
      sharpObject.composite([
        {
          input: `${__dirname}/assets/${compositing.wm}`,
          gravity: compositing.gr,
        },
      ]);

    // Get the buffer and metadata from the processed image
    const { data, info } = await sharpObject.toBuffer({
      resolveWithObject: true,
    });

    // ? A glitch is making some images to increase in size if processed
    // ? with a higher quality than 70, defaulting env to 70 for the moment
    if (info.size > metadata.size) {
      console.warn(
        `The processed size of ${info.size} is bigger than the original size of ${metadata.size}`
      );
    }

    // Build an S3 like object for the response parser and return the processed image
    const processedImage = {
      ContentLength: info.size,
      ContentType: `image/${info.format}`,
      Body: data,
    };

    const response = parseResponse(context, processedImage);
    return response;
  } catch (err) {
    const error = err.toString();
    console.error(error);
    const response = parseResponse(context, error, 500);
    return response;
  }
};

/**
 * Prepares a response object that can be returned from the Lambda function
 * @param {Object} context - The context from the Lambda runtime.
 * @param {(Object|String)} image - Either an Image object or a stringified error
 * @param {Number} status - The status of the response, defaults to 200
 * @return {Object} - The response object.
 */
const parseResponse = (context, image, status = 200) => {
  const cacheControlDefault = getSetting("DEFAULT_CACHE_CONTROL");
  const timenow = new Date();
  const headers = {
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": true,
    "Last-Modified": timenow.toString(),
    "Content-Length": image.ContentLength,
    "Content-Type":
      typeof image === "string" ? "application/json" : image.ContentType,
  };

  if (typeof image === "object") {
    if ("CacheControl" in image && image.CacheControl !== undefined) {
      headers["Cache-Control"] = image.CacheControl;
    } else if (cacheControlDefault) {
      headers["Cache-Control"] = cacheControlDefault;
    }
  }

  const error = JSON.stringify(
    {
      status: status,
      code: "internal-error",
      message: image,
    },
    2,
    null
  );

  const response = {
    statusCode: status,
    headers: headers,
    body: typeof image === "string" ? error : image.Body.toString("base64"),
    isBase64Encoded: typeof image === "string" ? false : true,
  };

  if (context && context.succeed) {
    context.succeed(response);
  }
  return response;
};
