exports.defaults = {
  resize: {
    w: undefined, // width
    h: undefined, // height
  },
  operations: {
    r: undefined, // rotation
    flip: undefined, // flip Y axis
    flop: undefined, // flop X axis
    af: undefined, // affine matrix
    afbg: "#000000", // affine background
    afi: "bicubic", // affine interpolator
    sh: undefined, // sharpen
    md: undefined, // median
    bl: undefined, // blur sigma
    fl: undefined, // flatten
    gm: undefined, // gamma
    ng: undefined, // negate
    nr: undefined, // normalize
    cl: undefined, // clahe
  },
  color: {},
  channel: {},
  compositing: {
    wm: undefined, // watermark
    gr: "southeast", // gravity
  },
  output: {
    q: 70, // quality
    fm: "jpeg", // format
    ll: false, // lossless
  },
};
