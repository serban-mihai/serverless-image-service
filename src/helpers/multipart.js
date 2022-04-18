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

  // Helper function when using non-matching groups
const getMatching = (string, regex) => {
    const matches = string.match(regex);
    if (!matches || matches.length < 2) {
      return null;
    }
    return matches[1];
  };
  