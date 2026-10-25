/**
 * Server-side stub for the native `canvas` package.
 *
 * `konva` ships a Node entry (`konva/cmj/index-node.js`) that requires `canvas`
 * as soon as the module is imported, and Next imports that entry while it
 * collects page data and renders static pages. The grid is browser-only, so no
 * canvas implementation is ever used on the server; only the import has to
 * succeed.
 *
 * The native package is not an option: `canvas@2.x` has no Node 22 build, and
 * building `canvas@3.x` from source needs cairo/pango on every build machine.
 * This stub keeps the build free of native dependencies. `createCanvas` throws
 * so that accidental server-side rendering fails loudly instead of silently
 * producing blank output.
 */

class DOMMatrix {
  constructor(init) {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
    if (Array.isArray(init) && init.length === 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }
}

class Path2D {
  constructor() {}
  addPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  rect() {}
}

class Image {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.src = '';
    this.complete = false;
  }
  addEventListener() {}
  removeEventListener() {}
}

function unsupported(name) {
  return () => {
    throw new Error(
      `[canvas-shim] ${name} is not available on the server. ` +
        'The konva grid renders in the browser only; a server-side render ' +
        'that reaches this call is a bug.',
    );
  };
}

const createCanvas = unsupported('createCanvas');
const loadImage = unsupported('loadImage');

function createImageData(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function registerFont() {}

module.exports = {
  Canvas: undefined,
  DOMMatrix,
  Image,
  ImageData: undefined,
  Path2D,
  createCanvas,
  createImageData,
  loadImage,
  registerFont,
};
