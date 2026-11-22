import { PixelGrid } from './pixels.mjs';

// Quiet backgrounds for the lower rail. Four inks step from wall shadow to court paint.
export const railInks = {
  fieldhouse: { k: '#111525', b: '#1b2235', s: '#2b3550', t: '#4a5772' },
  blacktop: { k: '#141827', b: '#232c36', s: '#35454b', t: '#536566' },
  pocket: { k: '#141a21', b: '#242d31', s: '#38443f', t: '#56634e' },
};

function backboard(g, x, y) {
  g.frame(x, y, 11, 7, 's', 'b');
  g.line(x + 1, y, x + 8, y, 't');
  g.frame(x + 3, y + 2, 5, 4, 's', 'b');
  g.stamp(['ttttttt', '.s.s.s.', '.ss.ss.', '..sss..'], x + 2, y + 5);
}

function fieldhouse(g) {
  g.box(0, 10, 32, 19, 'b');
  g.box(0, 10, 32, 1, 's');
  for (const x of [-2, 9, 22]) {
    g.stroke([[x, 10], [x + 4, 14], [x + 8, 10]], 'k');
    g.box(x + 4, 13, 4, 1, 's');
  }
  for (const [x, bottom] of [[1, 20], [5, 21], [26, 20]]) {
    g.box(x, 15, 3, bottom - 15, 's');
    g.dot(x, bottom - 1, 'b');
    g.dot(x + 2, bottom - 1, 'b');
  }
  g.box(0, 24, 32, 5, 'k');
  for (let x = 0; x < 32; x += 5) g.box(x, 25, 4, 3, 'b');
  g.box(15, 10, 1, 7, 's');
  backboard(g, 10, 16);
  g.box(0, 29, 32, 15, 'b');
  g.line(0, 29, 31, 29, 's');
  g.stroke([[11, 30], [6, 39], [25, 39], [20, 30]], 's');
  g.stroke([[6, 39], [9, 42], [22, 42], [25, 39]], 's');
  g.line(0, 36, 5, 31, 'k');
  g.line(31, 36, 26, 31, 'k');
}

function blacktop(g) {
  g.stamp(['.ss.', 'ssss', 'ssss', '.ss.'], 6, 10);
  for (const [x, y, width] of [[0, 18, 5], [5, 21, 7], [12, 15, 4], [17, 19, 6], [24, 14, 5], [29, 20, 4]]) {
    g.box(x, y, width, 29 - y, 'b');
    g.box(x + 1, y + 2, 1, 2, 's');
  }
  g.box(0, 24, 32, 9, 'b');
  for (let x = -6; x < 32; x += 4) {
    g.line(x, 25, x + 6, 31, 'k');
    g.line(x + 6, 25, x, 31, 'k');
  }
  g.line(0, 24, 31, 24, 's');
  g.box(3, 23, 1, 10, 's');
  g.box(16, 20, 2, 15, 's');
  backboard(g, 12, 16);
  g.box(0, 33, 32, 11, 'b');
  g.line(0, 33, 31, 33, 'k');
  g.stroke([[8, 34], [4, 41], [17, 41], [22, 34]], 's');
  g.line(0, 43, 29, 34, 't');
  g.box(1, 30, 7, 1, 't');
  g.box(2, 31, 1, 3, 's');
  g.box(6, 31, 1, 3, 's');
}

function pocket(g) {
  g.frame(4, 12, 22, 28, 's', 'b');
  g.box(6, 13, 1, 26, 's');
  for (let y = 15; y < 39; y += 5) {
    g.box(2, y, 5, 1, 'k');
    g.box(2, y - 1, 4, 1, 't');
  }
  g.box(9, 15, 9, 1, 't');
  g.box(9, 17, 5, 1, 's');
  // Half court and three marks in a coach's pocket scorebook.
  g.frame(9, 20, 14, 12, 's', 'b');
  g.frame(13, 20, 5, 4, 's', 'b');
  g.stroke([[11, 21], [11, 24], [13, 26], [18, 26], [20, 24], [20, 21]], 't');
  g.stamp(['s.s', '.s.', 's.s'], 11, 27);
  g.stamp(['.t.', 't.t', '.t.'], 18, 27);
  g.box(9, 34, 6, 1, 't');
  g.box(17, 34, 5, 1, 's');
  g.box(9, 36, 10, 1, 's');
  g.line(22, 37, 29, 19, 's');
  g.line(23, 37, 30, 19, 't');
  g.dot(22, 38, 't');
}

export function sideline(style) {
  const g = new PixelGrid(32, 44, 'k');
  ({ fieldhouse, blacktop, pocket })[style](g);
  return g;
}
