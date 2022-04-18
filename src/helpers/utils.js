/**
 * Parse the Content-Type header to retrieve the Boundary key
 * @param {string} contentType The Content-Type from the request event of type multipart
 * @return {string} The Boundery string or null
 */
exports.parseMultipartBoundary = (contentType) => {
  const contentTypeArray = contentType.split(";").map((item) => item.trim());
  const boundaryPrefix = "boundary=";
  let boundary = contentTypeArray.find((item) =>
    item.startsWith(boundaryPrefix)
  );
  if (!boundary) return null;
  boundary = boundary.slice(boundaryPrefix.length);
  if (boundary) boundary = boundary.trim();
  return boundary;
};

/**
 * Parse the body of a multipart request and return the files structure
 * @param {string} body The body of the multipart/form-data request
 * @param {string} boundary The Boundary separator string retrieved from the request header
 * @return {Object} An object with parsed data if KV or a files key with a list of assets
 */
exports.parseMultipartBody = (body, boundary) => {
  let result = {};
  const rawDataArray = body.split(boundary);
  for (const item of rawDataArray) {
    let name = getMatching(item, /(?:name=")(.+?)(?:")/);
    if (!name || !(name = name.trim())) continue;
    let value = getMatching(item, /(?:\r\n\r\n)([\S\s]*)(?:\r\n--$)/);
    if (!value) continue;
    let filename = getMatching(item, /(?:filename=")(.*?)(?:")/);
    if (filename && (filename = filename.trim())) {
      // Add the file information in a files array
      let file = {};
      file[name] = value;
      file["filename"] = filename;
      let contentType = getMatching(item, /(?:Content-Type:)(.*?)(?:\r\n)/);
      if (contentType && (contentType = contentType.trim())) {
        file["Content-Type"] = contentType;
      }
      if (!result.files) {
        result.files = [];
      }
      result.files.push(file);
    } else {
      // Key/Value pair
      result[name] = value;
    }
  }
  return result;
};

/**
 * Parse the query parameters from a request and return their edits values after sanitize
 * @param {Object} params The query parameters object from the request
 * @param {Object} metadata Metadata from the original image
 * @return {Object} An object with final valid edits and options to be applied to the image requested
 */
exports.parseQueryParams = (params, metadata) => {
  const { getSetting } = require("../helpers/settings");
  const { formats } = require("../lib/formats");
  const { format, size, width, height, hasAlpha } = metadata;

  // Parse query parameters to their type values (besides the s query param)
  const edits = {};

  edits.w = params.hasOwnProperty("w")
    ? parseValue(params.w, "number", false)
    : undefined;
  edits.h = params.hasOwnProperty("h")
    ? parseValue(params.h, "number", false)
    : undefined;
  edits.fm =
    params.hasOwnProperty("fm") && formats.includes(params.fm)
      ? parseValue(params.fm, "string")
      : format;

  // Quality and some file specifics options for the image processing
  const defaultQuality = getSetting("DEFAULT_QUALITY");
  const q = params.hasOwnProperty("q") ? parseInt(params.q) : defaultQuality;
  const lossless = params.hasOwnProperty("ll")
    ? parseValue(params.ll, "boolean")
    : false;

  const options = {
    quality: q <= 70 ? q : 70, // ? Default to 70 until size bug is fixed
    effort: 1, // ! Not available for some formats, need to check if it might break anything
  };

  switch (edits.fm) {
    case "png":
      options["compressionLevel"] = 6;
      options["palette"] = true;
      break;
    case "webp":
    case "avif": // ? Returns Content-Type: image/heif
      options["lossless"] = lossless;
      break;
    default:
      break;
  }

  return { edits, options };
};

/**
 * Parse the value of a specific query param and convert it to ensure the correct output type
 * @param {(String|Number|Boolean)} value - The incoming value of a query param
 * @param {String} type - The desired output type for the input value
 * @param {Boolean} negative - Default true allows and false disallows negative values
 * @return {(String|Number|Boolean)} - The output value after the parsing process
 */
const parseValue = (value, type, negative = true) => {
  let parsed;
  if (type === "string" && typeof value !== "string") parsed = value.toString();
  else if (type === "number" && typeof value !== "number") {
    const temp = isNaN(parseInt(value)) ? undefined : parseInt(value);
    if (temp < 0) {
      parsed = negative ? temp : undefined;
    } else {
      parsed = temp;
    }
  } else if (type === "boolean" && typeof value !== "boolean") {
    const isNumber = isNaN(parseInt(value)) ? false : true;
    if (isNumber) {
      switch (parseInt(value)) {
        case 0:
          parsed = false;
          break;
        case 1:
          parsed = true;
          break;
        default:
          parsed = false;
          break;
      }
    } else {
      try {
        parsed = JSON.parse(value.toLowerCase());
      } catch (err) {
        parsed = false;
      }
    }
  } else parsed = value;
  return parsed;
};

// Helper function when using non-matching groups
const getMatching = (string, regex) => {
  const matches = string.match(regex);
  if (!matches || matches.length < 2) {
    return null;
  }
  return matches[1];
};
