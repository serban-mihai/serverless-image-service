const { getSetting } = require("./settings");
const { formats } = require("../lib/formats");
const { defaults } = require("../lib/defaults");
const verboseErrors = getSetting("ALLOW_VERBOSE_ERRORS");

/**
 * Parse the query parameters from a request and return their edits values after sanitize
 * @param {Object} params The query parameters object from the request
 * @param {Object} metadata Metadata from the original image
 * @return {Object} An object with final valid edits and options to be applied to the image requested
 */
exports.parseQueryParams = (params, metadata) => {
  const { format, size, width, height, hasAlpha } = metadata;

  // Parse query parameters to their type values (besides the s query param)
  const edits = {};

  edits.w = params.hasOwnProperty("w")
    ? parseValue(params.w, "number", verboseErrors)
    : defaults.w;
  edits.h = params.hasOwnProperty("h")
    ? parseValue(params.h, "number", verboseErrors)
    : defaults.h;
  edits.fm =
    params.hasOwnProperty("fm") && formats.includes(params.fm)
      ? parseValue(params.fm, "string")
      : format;
  edits.wm = params.hasOwnProperty("wm")
    ? parseValue(params.wm, "string")
    : defaults.wm;
  edits.gr = params.hasOwnProperty("gr")
    ? parseValue(params.gr, "string")
    : defaults.gr;

  // Quality and some file specifics options for the image processing
  const defaultQuality = getSetting("DEFAULT_QUALITY");
  const q = params.hasOwnProperty("q")
    ? parseValue(params.q, "number", verboseErrors)
    : defaultQuality;
  const lossless = params.hasOwnProperty("ll")
    ? parseValue(params.ll, "boolean")
    : defaults.ll;

  const options = {
    quality: q <= 70 ? q : defaults.q, // ? Default to 70 until size bug is fixed
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
