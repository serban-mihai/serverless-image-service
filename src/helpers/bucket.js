const S3Exception = require("../errors/S3Exception");
const S3 = require("aws-sdk/clients/s3");
const s3 = new S3({ region: "eu-central-1" });

/**
 * Gets the original image from an Amazon S3 bucket.
 * @param {String} bucket - The name of the bucket containing the image.
 * @param {String} key - The key name corresponding to the image.
 * @return {Promise} - The original image or an error.
 */
exports.getOriginalImage = async (bucket, key) => {
  const imageLocation = {
    Bucket: bucket,
    Key: decodeURIComponent(key),
  };
  try {
    const originalImage = await s3.getObject(imageLocation).promise();
    return Promise.resolve(originalImage);
  } catch (err) {
    const error = new S3Exception(err.statusCode, err.code, err.message);
    return Promise.reject(error);
  }
};

/**
 * Attempts to upload a new image in an Amazon S3 bucket
 * @param {Object} image - The Object parameters that describe the image to be uploaded
 * @return {Promise} - The status of the upload, either successfull ETag, or error.
 */
exports.uploadImage = async (image) => {
  try {
    const status = await s3.putObject(image).promise();
    return Promise.resolve(status);
  } catch (err) {
    const error = new S3Exception(err.statusCode, err.code, err.message);
    return Promise.reject(error);
  }
};

/**
 * Remove an existing image on S3
 * @param {String} bucket - The name of the bucket where the image should be uploaded.
 * @param {String} key - The key name corresponding to the image full path with extension.
 * @return {Promise} - The status of the removal, either successfull or error.
 */
exports.removeImage = async (bucket, key) => {
  const imageLocation = {
    Bucket: bucket,
    Key: decodeURIComponent(key),
  };
  try {
    const status = await s3.deleteObject(imageLocation).promise();
    return Promise.resolve(status);
  } catch (err) {
    const error = new S3Exception(err.statusCode, err.code, err.message);
    return Promise.reject(error);
  }
};

/**
 * Gets the list of all keys of an Amazon S3 bucket.
 * @param {String} bucket - The name of the bucket to explore.
 * @param {Number} keys - The max number of keys to be returned.
 * @return {Promise} - The images' list or an error.
 */
exports.listImages = async (bucket, keys = 1000) => {
  const params = {
    Bucket: bucket,
    MaxKeys: keys,
  };
  const request = s3.listObjectsV2(params).promise();
  try {
    const list = await request;
    return Promise.resolve(list);
  } catch (err) {
    const error = new S3Exception(err.statusCode, err.code, err.message);
    return Promise.reject(error);
  }
};

/**
 * Parses the name of the appropriate Amazon S3 key corresponding to the
 * original image.
 * @param uri
 * @param requiredPrefix
 */
exports.parseImageKey = (uri, requiredPrefix = null) => {
  // Decode the image request and return the image key
  // Ensure the path starts with our prefix
  let key = decodeURI(uri);
  if (key.startsWith("/")) {
    key = key.substring(1);
  }
  if (key.endsWith("/")) {
    key = key.substring(0, key.length - 1);
  }
  if (requiredPrefix) {
    if (!key.startsWith(requiredPrefix)) {
      key = requiredPrefix + "/" + key;
    }
  }
  return key;
};

/**
 * Retrieves metadata about an existing key in an Amazon S3 Bucket
 * @param {String} bucket - The name of the bucket where look for the image.
 * @param {String} key - The key name corresponding to the image full path with extension.
 * @return {Promise} - The image metadata or an error.
 */
exports.getMetadata = async (bucket, key) => {
  const imageLocation = {
    Bucket: bucket,
    Key: decodeURIComponent(key),
  };
  try {
    await s3.headObject(imageLocation).promise();
    return true;
  } catch (err) {
    if (err.code === "NotFound") {
      return false;
    }
    throw err;
  }
};
