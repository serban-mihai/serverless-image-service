const { getBooleanImage } = require("./queryParams");

/**
 * Chains together the edits over the image requested, applying eveything that
 * matches to the requested query parameters detected
 * @param {Sharp} sharpObject - The Sharp object from the original image on which o apply edits
 * @param {Object} edits - The matched query parameters and their values
 * @param {Object} options - Additional parameters for quality and format
 * @param {Object} metadata - Metadata from the original image for comparison to some options
 * @return Returns void after applying all image manipulations on the Sharp object
 */
exports.processImage = async (sharpObject, edits, options, metadata) => {
  const { resize, operations, color, channel, compositing, output } = edits;

  // Applying resize, original metadata for rotation and converting to a custom format
  // ? Resizing and Output
  sharpObject
    .resize(resize.w, resize.h, { withoutEnlargement: true })
    .withMetadata()
    .toFormat(output.fm, options);

  // ? Image Operations
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
  if (operations.nr) sharpObject.normalize();
  if (operations.cl) sharpObject.clahe(operations.cl);
  if (operations.cv) sharpObject.convolve(operations.cv);
  if (operations.th) sharpObject.threshold(operations.th);
  if (operations.bo) {
    const { operator, source } = operations.bo;
    const operand = await getBooleanImage(source);
    sharpObject.boolean(operand, operator);
  }
  if (operations.li) sharpObject.linear(operations.li[0], operations.li[1]);
  if (operations.rc) sharpObject.recomb(operations.rc);
  if (operations.mo) sharpObject.modulate(operations.mo);

  // ? Color Manipulation
  if (color.t) sharpObject.tint(color.t);
  if (color.g) sharpObject.greyscale();
  if (color.pc) sharpObject.pipelineColourspace(color.pc);
  if (color.tc) sharpObject.toColourspace(color.tc);

  // ? Channel Manipulation
  if (channel.ra && metadata.hasAlpha) sharpObject.removeAlpha();
  if (channel.ea && !metadata.hasAlpha) sharpObject.ensureAlpha(channel.ea);
  if (channel.ec) sharpObject.extractChannel(channel.ec);
  if (channel.jc) {
    let toJoin = [];
    for (const image of channel.jc) {
      const temp = await getBooleanImage(image);
      toJoin.push(temp);
    }
    sharpObject.joinChannel(toJoin);
  }
  if (channel.bb) sharpObject.bandbool(channel.bb);

  // ? Compositing
  // If the Watermark param is set, apply it over the image along with the gravity position
  if (compositing.wm)
    sharpObject.composite([
      {
        input: `${__dirname.replace("/helpers", "")}/assets/${compositing.wm}`,
        gravity: compositing.gr,
      },
    ]);

  return;
};
