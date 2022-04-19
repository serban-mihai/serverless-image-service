const { getSetting } = require("./settings");
const { formats } = require("../lib/formats");
const { defaults } = require("../lib/defaults");
const verboseErrors = getSetting("ALLOW_VERBOSE_ERRORS");
const https = require("https");

/**
 * Parse the query parameters from a request and return their edits values after sanitize
 * @param {Object} params - The query parameters object from the request
 * @param {Object} metadata - Metadata from the original image
 * @return {Object} - An object with final valid edits and options to be applied to the image requested
 */
exports.parseQueryParams = (params, metadata) => {
  const { format, size, width, height, hasAlpha } = metadata;
  const { resize, operations, color, channel, compositing, output } = defaults;

  // Parse query parameters to their type values (besides the s query param)
  const edits = defaults;

  // ? Resizing Operations
  edits.resize.w = params.hasOwnProperty("w")
    ? parseValue(params.w, "integer", verboseErrors)
    : resize.w;
  edits.resize.h = params.hasOwnProperty("h")
    ? parseValue(params.h, "integer", verboseErrors)
    : resize.h;

  // ? Image Operations
  edits.operations.r = params.hasOwnProperty("r") // Rotation
    ? parseValue(params.r, "integer", verboseErrors)
    : operations.r;
  edits.operations.flip = params.hasOwnProperty("flip") // Flip Y
    ? parseValue(params.flip, "boolean")
    : operations.flip;
  edits.operations.flop = params.hasOwnProperty("flop") // Flop X
    ? parseValue(params.flop, "boolean")
    : operations.flop;
  edits.operations.af = params.hasOwnProperty("af") // Affine
    ? parseValue(params.af, "array")
    : operations.af;
  edits.operations.afbg = params.hasOwnProperty("afbg") // Affine Background
    ? parseValue(params.afbg, "string")
    : operations.afbg;
  edits.operations.afi = params.hasOwnProperty("afi") // Affine Interpolation
    ? parseValue(params.afi, "string")
    : operations.afi;
  edits.operations.sh = params.hasOwnProperty("sh") // Sharpen
    ? parseValue(params.sh, "object")
    : operations.sh;
  edits.operations.md = params.hasOwnProperty("md") // Median
    ? parseValue(params.md, "integer", verboseErrors)
    : operations.md;
  edits.operations.bl = params.hasOwnProperty("bl") // Blur Sigma
    ? parseValue(params.bl, "float", verboseErrors)
    : operations.bl;
  edits.operations.fl = params.hasOwnProperty("fl") // Flatten
    ? parseValue(params.fl, "string")
    : operations.fl;
  edits.operations.gm = params.hasOwnProperty("gm") // Gamma
    ? parseValue(params.gm, "array")
    : operations.gm;
  edits.operations.ng = params.hasOwnProperty("ng") // Negate
    ? parseValue(params.ng, "boolean")
    : operations.ng;
  edits.operations.nr = params.hasOwnProperty("nr") // Normalize
    ? parseValue(params.nr, "boolean")
    : operations.nr;
  edits.operations.cl = params.hasOwnProperty("cl") // Clahe
    ? parseValue(params.cl, "object")
    : operations.cl;
  edits.operations.cv = params.hasOwnProperty("cv") // Convolve
    ? parseValue(params.cv, "object")
    : operations.cv;
  edits.operations.th = params.hasOwnProperty("th") // Thershold
    ? parseValue(params.th, "integer", verboseErrors)
    : operations.th;
  edits.operations.bo = params.hasOwnProperty("bo") // Boolean
    ? parseValue(params.bo, "object")
    : operations.bo;
  edits.operations.li = params.hasOwnProperty("li") // Linear
    ? parseValue(params.li, "array")
    : operations.li;
  edits.operations.rc = params.hasOwnProperty("rc") // Recomb
    ? parseValue(params.rc, "array")
    : operations.rc;
  edits.operations.mo = params.hasOwnProperty("mo") // Recomb
    ? parseValue(params.mo, "object")
    : operations.mo;

  // ? Color Manipulation
  edits.color.t = params.hasOwnProperty("t") // Tint
    ? parseValue(params.t, "object")
    : color.t;
  edits.color.g = params.hasOwnProperty("g") // Grayscale
    ? parseValue(params.g, "boolean")
    : color.g;
  edits.color.pc = params.hasOwnProperty("pc") // Pipeline Colour Space
    ? parseValue(params.pc, "string")
    : color.pc;
  edits.color.tc = params.hasOwnProperty("tc") // To Colour Space
    ? parseValue(params.tc, "string")
    : color.tc;

  // ? Channel Manipulation
  edits.channel.ra = params.hasOwnProperty("ra") // Remove Alpha Channel
    ? parseValue(params.ra, "boolean")
    : channel.ra;
  edits.channel.ea = params.hasOwnProperty("ea") // Ensure Alpha Channel
    ? parseValue(params.ea, "float")
    : channel.ea;
  edits.channel.ec = params.hasOwnProperty("ec") // Extract Channel
    ? parseValue(params.ec, "string")
    : channel.ec;
  edits.channel.jc = params.hasOwnProperty("jc") // Join Channels
    ? parseValue(params.jc, "array")
    : channel.jc;
  edits.channel.bb = params.hasOwnProperty("bb") // BandBool
    ? parseValue(params.bb, "string")
    : channel.bb;

  // ? Compositing Images
  edits.compositing.wm = params.hasOwnProperty("wm") // Watermarn Name
    ? parseValue(params.wm, "string")
    : compositing.wm;
  edits.compositing.gr = params.hasOwnProperty("gr") // Gravity For Watermark
    ? parseValue(params.gr, "string")
    : compositing.gr;

  // ? Output Options
  edits.output.fm =
    params.hasOwnProperty("fm") && formats.includes(params.fm) // Format Output
      ? parseValue(params.fm, "string")
      : format;

  const defaultQuality = getSetting("DEFAULT_QUALITY");
  const q = params.hasOwnProperty("q") // Quality
    ? parseValue(params.q, "integer", verboseErrors)
    : output.q;
  const ll = params.hasOwnProperty("ll") // Lossless
    ? parseValue(params.ll, "boolean")
    : output.ll;

  // Quality and some file specifics options for the image processing
  const options = {
    quality: q <= 70 ? q : output.q, // ? Default to 70 until size bug is fixed
    effort: 1, // ! Not available for some formats, need to check if it might break anything
  };

  switch (edits.fm) {
    case "png":
      options["compressionLevel"] = 6;
      options["palette"] = true;
      break;
    case "webp":
    case "avif": // ? Returns Content-Type: image/heif
      options["lossless"] = ll;
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
  if (
    (type === "array" && typeof value !== "array") ||
    (type === "object" && typeof value !== "object")
  ) {
    try {
      parsed = JSON.parse(value);
    } catch (err) {
      if (type === "array") parsed = [];
      else if (type === "object") parsed = {};
    }
  } else if (type === "string" && typeof value !== "string")
    parsed = value.toString();
  else if (type === "integer" && typeof value !== "integer") {
    const temp = isNaN(parseInt(value)) ? undefined : parseInt(value);
    if (temp < 0) parsed = negative ? temp : undefined;
    else parsed = temp;
  } else if (type === "float" && typeof value !== "float") {
    const temp = isNaN(parseFloat(value)) ? undefined : parseFloat(value);
    if (temp < 0) parsed = negative ? temp : undefined;
    else parsed = temp;
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

/**
 * Gets an image to Buffer for Boolean operations, using https to avoid external dependencies
 * @param {String} url - The URL from where the image to be fetched
 * @return {Buffer} - The binary Buffer of the image to be applied operand to Boolean
 */
exports.getBooleanImage = (url) => {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const body = [];
      res
        .on("data", (chunk) => {
          body.push(chunk);
        })
        .on("end", () => {
          try {
            resolve(Buffer.concat(body));
          } catch (err) {
            reject(new Error(err));
          }
        });
    });
    req.on("error", (err) => {
      reject(new Error(err));
    });
  });
};
