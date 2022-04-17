const { beforeHandleRequest } = require("./helpers/security");
const { getSetting } = require("./helpers/settings");
const { getOriginalImage, parseImageKey } = require("./helpers/bucket");
const { formats } = require("./lib/formats");
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
    const edits = event.queryStringParameters;

    // TODO: Find a way to serve requests without query parameters directly
    // TODO: from S3, avoiding useless Lambda triggers
    // There is no query param for image manipulation, return the original image
    if (!edits) {
      const response = parseResponse(context, originalImage);
      return response;
    }

    // Query params detected, making transforms over the original image
    const sharpObject = sharp(originalImage.Body);
    const { format, size, width, height, hasAlpha } =
      await sharpObject.metadata();

    // TODO: Move below block into a separate function in utils to avoid confusion and bloating
    // Parse query parameters to their type values (besides the s query param)
    const defaultQuality = getSetting("DEFAULT_QUALITY");
    const q = edits.hasOwnProperty("q") ? parseInt(edits.q) : defaultQuality;
    const w = edits.hasOwnProperty("w") ? parseInt(edits.w) : undefined;
    const h = edits.hasOwnProperty("h") ? parseInt(edits.h) : undefined;
    let fm = edits.hasOwnProperty("fm") ? edits.fm : format;

    // If the format is not supported, bad spelled or mispelled return the original format
    if (!formats.includes(fm)) {
      fm = format;
    }

    // TODO: Move below block into a separate function in utils to avoid confusion and bloating
    // Quality and some file specifics options for the image processing
    const options = {
      quality: q,
      effort: 1, // ! Not available for some formats, need to check if it might break anything
    };
    switch (fm) {
      case "png":
        options["compressionLevel"] = 9;
        options["palette"] = true;
      case "webm":
      case "avif": // ? Returns Content-Type: image/heif conversion takes ages and the image size is hudge
        options["lossless"] = true;
    }

    // Applying edits
    const { data, info } = await sharpObject
      .resize(w, h, { withoutEnlargement: true })
      .withMetadata()
      .toFormat(fm, options)
      .toBuffer({ resolveWithObject: true });

    // ? A glitch is making some images to increase in size if processed
    // ? with a higher quality than 70, defaulting env to 70 for the moment
    if (info.size > size) {
      console.warn(
        `The processed size of ${info.size} is bigger than the original size of ${size}`
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

  const response = {
    statusCode: status,
    headers: headers,
    body: typeof image === "string" ? image : image.Body.toString("base64"),
    isBase64Encoded: typeof image === "string" ? false : true,
  };

  if (context && context.succeed) {
    context.succeed(response);
  }
  return response;
};
