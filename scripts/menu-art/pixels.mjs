// One character is one source pixel. A dot is transparent.
export const palettes = {
  fieldhouse: {
    k: '#172133', d: '#253551', b: '#405e83', s: '#7993a2', t: '#74a49b',
    c: '#f2dfb4', l: '#fff0cf', o: '#edb554', w: '#c98653', r: '#ad5144', h: '#d89a67', u: '#714b47',
  },
  blacktop: {
    k: '#1e2032', d: '#343345', b: '#385b68', s: '#62838a', t: '#77aea2',
    c: '#efd4a8', l: '#fff0c5', o: '#eda55e', w: '#ca7952', r: '#bf5e4f', h: '#de9267', u: '#804b4b',
  },
  pocket: {
    k: '#263824', d: '#263824', b: '#596d43', s: '#596d43', t: '#9eac69',
    c: '#e0e3ad', l: '#e0e3ad', o: '#9eac69', w: '#9eac69', r: '#596d43', h: '#9eac69', u: '#596d43',
  },
};

const font = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],
  '8':['111','101','111','101','111'], '-':['00','00','11','00','00'],
  '?':['111','001','011','000','010'], V:['101','101','101','101','010'], S:['111','100','111','001','111'],
};

export class PixelGrid {
  constructor(width, height, background = '.') {
    this.width = width;
    this.height = height;
    this.rows = Array.from({ length: height }, () => Array(width).fill(background));
  }
  dot(x, y, ink) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.rows[y][x] = ink;
  }
  box(x, y, width, height, ink) {
    for (let row = y; row < y + height; row++)
      for (let col = x; col < x + width; col++) this.dot(col, row, ink);
  }
  frame(x, y, width, height, edge, face) {
    this.box(x, y, width, height, edge);
    this.box(x + 1, y + 1, width - 2, height - 2, face);
  }
  line(x, y, endX, endY, ink) {
    const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
    const stepX = x < endX ? 1 : -1, stepY = y < endY ? 1 : -1;
    let error = dx + dy;
    while (true) {
      this.dot(x, y, ink);
      if (x === endX && y === endY) return;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += stepX; }
      if (twice <= dx) { error += dx; y += stepY; }
    }
  }
  stroke(points, ink) {
    for (let i = 1; i < points.length; i++) this.line(...points[i - 1], ...points[i], ink);
  }
  stamp(rows, x, y, options = {}) {
    const { scale = 1, flip = false, colors = {} } = options;
    for (const [row, pixels] of rows.entries()) {
      for (const [col, pixel] of [...pixels].entries()) {
        if (pixel === '.') continue;
        const dx = flip ? pixels.length - 1 - col : col;
        this.box(x + dx * scale, y + row * scale, scale, scale, colors[pixel] ?? pixel);
      }
    }
  }
  text(value, x, y, color, scale = 1) {
    for (const char of value) {
      const glyph = font[char];
      this.stamp(glyph.map(row => row.replaceAll('0','.')), x, y, { scale, colors: { '1': color } });
      x += (glyph[0].length + 1) * scale;
    }
  }
  rgba(palette) {
    const entries = Object.fromEntries(Object.entries(palette).map(([id, hex]) => [
      id, [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).concat(255),
    ]));
    entries['.'] = [0, 0, 0, 0];
    return Buffer.from(this.rows.flat().flatMap(ink => {
      if (!entries[ink]) throw new Error(`Unknown palette ink '${ink}'`);
      return entries[ink];
    }));
  }
}
