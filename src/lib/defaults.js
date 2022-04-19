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
    cv: undefined, // convolve
    th: undefined, // threshold
    bo: undefined, // boolean
    li: undefined, // linear
    rc: undefined, // recomb
    mo: undefined, // modulate
  },
  color: {
    t: undefined, // tint
    g: undefined, // grayscale
    pc: undefined, // pipeline colour space
    tc: undefined, // to colour space
  },
  channel: {
    ra: undefined, // remove alpha channel
    ea: undefined, // ensure alpha
    ec: undefined, // extract channel
    jc: undefined, // join channels
    bb: undefined, // bandbool
  },
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
