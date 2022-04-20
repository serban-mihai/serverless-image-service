const { getImage } = require("./queryParams");

/**
 * Chains together the edits over the image requested, applying eveything that
 * matches to the requested query parameters detected
 * @param {Sharp} sharpObject - The Sharp object from the original image on which o apply edits
 * @param {Object} edits - The matched query parameters and their values
 * @param {Object} outputOptions - Additional parameters for quality and format output
 * @param {Object} metadata - Metadata from the original image for comparison to some options
 * @return Returns void after applying all image manipulations on the Sharp object
 */
exports.processImage = async (sharpObject, edits, outputOptions, metadata) => {
  const { resize, operations, color, channel, compositing, output } = edits;
  sharpObject.withMetadata(); // Adding metadata from original image

  // Build an option object for resize
  const resizeOptions = {
    withoutEnlargement: true,
  };

  if (resize.w && resize.h && resize.f) resizeOptions["fit"] = resize.f;
  if (resize.w && resize.h && resize.f && resize.p)
    resizeOptions["position"] = resize.p;
  if (resize.bg) resizeOptions["background"] = resize.bg;
  if (resize.k) resizeOptions["kernel"] = resize.k;

  // ? Resizing Images
  if (resize.cb) sharpObject.extract(resize.cb);
  if (resize.w || resize.h)
    sharpObject.resize(resize.w, resize.h, resizeOptions);
  if (resize.ca) sharpObject.extract(resize.ca);
  if (resize.ex) {
    const param = resize.ex;
    if (resize.bg) param["background"] = resize.bg;
    sharpObject.extend(param);
  }
  if (resize.tr) sharpObject.trim(resize.tr);

  // ? Image Operations
  if (operations.r) sharpObject.rotate(operations.r);
  if (operations.flip) sharpObject.flip();
  if (operations.flop) sharpObject.flop();
  if (operations.af)
    sharpObject.affine(operations.af, {
      background: operations.afbg,
      interpolator: operations.afi,
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
    const operand = await getImage(source);
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
      const temp = await getImage(image);
      toJoin.push(temp);
    }
    sharpObject.joinChannel(toJoin);
  }
  if (channel.bb) sharpObject.bandbool(channel.bb);

  // ? Compositing Images
  if (compositing.wm)
    // If the Watermark param is set, apply it over the image along with the gravity position
    sharpObject.composite([
      {
        input: `${__dirname.replace("/helpers", "")}/assets/${compositing.wm}`,
        gravity: compositing.gr,
      },
    ]);

  // ? Output options
  if (output.fm) sharpObject.toFormat(output.fm, outputOptions);
  return;
};
