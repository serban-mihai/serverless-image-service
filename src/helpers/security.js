const settings = require("./settings");
const HashException = require("../errors/HashException");

/**
 * Computes a hash based on the path, query string params
 * @param {string} path
 * @param {Object} queryStringParameters
 * @param {string} securityKey
 * @return {string}
 */
exports.calculateHash = (path, queryStringParameters, securityKey) => {
  const crypto = require("crypto");

  // Get the full query (minus the hash parameter)
  const query = buildQueryStringFromObject(queryStringParameters);

  // Encode each part of the URI. (Note, we're not using URLEncode on the entire thing, as it doesn't
  // properly handle "+" signs
  const encodedPath = fixedEncodeURIComponent(decodeURIComponent(path));
  const source = securityKey + encodedPath + query;
  const parsed = crypto.createHash("md5").update(source).digest("hex");
  return parsed;
};

/**
 *
 * @param path
 * @param queryStringParameters
 * @param hash
 * @returns {boolean}
 */
exports.verifyHash = (path, queryStringParameters, hash) => {
  const parsed = this.calculateHash(
    path,
    queryStringParameters,
    settings.getSetting("SECURITY_KEY")
  );
  return parsed.toLowerCase() === hash.toLowerCase();
};

//? For security Hash of the s query param, needs investigation
/**
 * Parses the name of the appropriate Amazon S3 key corresponding to the
 * original image.
 * @param {Object} event - Lambda request body.
 */
exports.checkHash = (event) => {
  const { queryStringParameters, path } = event;
  if (queryStringParameters && queryStringParameters.s === undefined) {
    throw new HashException();
  }
  if (queryStringParameters) {
    const hash = queryStringParameters.s;
    const isValid = verifyHash(path, queryStringParameters, hash);
    if (!isValid) {
      throw new HashException();
    }
  }
  return true;
};

/**
 * Checks for the security paramerer "s", if not needed returns
 * the response, else returns not found message
 */
exports.beforeHandleRequest = (event) => {
  const timenow = new Date();
  const headers = {
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": true,
    "Last-Modified": timenow.toString(),
    "Content-Type": "application/json",
  };
  const result = {
    allowed: true,
  };
  if (shouldSkipRequest(event.path)) {
    result.allowed = false;
    result.response = {
      statusCode: 404,
      headers: headers,
      body: null,
      isBase64Encoded: false,
    };
  }

  return result;
};

const buildQueryStringFromObject = (queryStringParameters) => {
  let string = "";
  for (const [k, v] of Object.entries(queryStringParameters)) {
    // Don't hash the security token
    if (k !== "s") {
      string += "&" + k + "=" + encodeURIComponent(v);
    }
  }
  if (string.substring(1) === "") {
    return "";
  }
  return "?" + string.substring(1);
};

/**
 * RFC 3986 encodeURIComponent
 * @param str
 * @return {string}
 */
const fixedEncodeURIComponent = (str) => {
  return str.replace(/([^\w\-\/\:@])/gi, function (match) {
    return encodeURIComponent(match)
      .replace(/!/g, "%21")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
  });
};

/**
 * Returns true if the request should be 404'd immediately
 * @param path
 * @return {boolean}
 */
const shouldSkipRequest = (path) => {
  // Check if the file is explicitly ignored
  if (settings.getSetting("SLS_IGNORE")) {
    const filesToIgnore = settings.getSetting("SLS_IGNORE");
    // Remove the starting slash and check if the file should be ignored
    if (filesToIgnore.includes(path.substring(1))) {
      return true;
    }
  }

  // Check if the path matches our regex pattern
  if (!settings.getSetting("SLS_VALID_PATH_REGEX")) {
    return false;
  }
  const validPathRegex = settings.getSetting("SLS_VALID_PATH_REGEX");
  return !validPathRegex.test(path);
};
