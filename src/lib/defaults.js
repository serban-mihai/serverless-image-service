exports.defaults = {
  resize: {
    w: undefined, // width
    h: undefined, // height
  },
  operations: {
    r: undefined, // rotation
    flip: false, // flip Y axis
    flop: false, // flop X axis
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