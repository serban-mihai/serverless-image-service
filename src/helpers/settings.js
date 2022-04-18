const SettingsException = require("../errors/SettingsException");

const TYPE_INTEGER = "integer";
const TYPE_ARRAY_STRING = "arraystring";
const TYPE_REGEX = "regex";
const TYPE_STRING = "string";
const TYPE_BOOLEAN = "boolean";

const settings = {
  DEFAULT_QUALITY: {
    default: 75,
    type: TYPE_INTEGER,
  },
  SLS_IGNORE: {
    default: "",
    type: TYPE_ARRAY_STRING,
  },
  SLS_VALID_PATH_REGEX: {
    default: ".*",
    type: TYPE_REGEX,
  },
  DEFAULT_CACHE_CONTROL: {
    default: "",
    type: TYPE_STRING,
  },
  SOURCE_BUCKET: {
    default: "",
    type: TYPE_STRING,
  },
  SECURITY_KEY: {
    default: "",
    type: TYPE_STRING,
  },
  ALLOW_VERBOSE_ERRORS: {
    default: true,
    type: TYPE_BOOLEAN,
  },
};

/**
 * Gets a setting from the config
 * @param key
 * @return {string|null}
 */
exports.getSetting = function (key) {
  if (!(key in settings)) {
    throw new SettingsException();
  }
  let value = null;
  if (key in process.env) {
    value = process.env[key];
  } else {
    value = settings[key].default;
  }

  return processValue(key, value);
};

const processValue = function (setting, value) {
  switch (settings[setting].type) {
    case TYPE_STRING:
      return processString(value);
    case TYPE_INTEGER:
      return processInteger(value);
    case TYPE_BOOLEAN:
      return processBoolean(value);
    case TYPE_ARRAY_STRING:
      return processStringArray(value);
    case TYPE_REGEX:
      return processRegExValue(value);
    default:
      throw new SettingsException();
  }
};

const processString = function (value) {
  if (value === "" || value == null) {
    return null;
  }
  return value.toString();
};

const processInteger = function (value) {
  return parseInt(value);
};

const processBoolean = function (value) {
  try {
    return JSON.parse(value.toLowerCase());
  } catch (err) {
    return false;
  }
};

const processStringArray = function (value) {
  return value.split(",");
};

const processRegExValue = function (value) {
  return new RegExp(value);
};
