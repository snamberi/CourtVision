// Stamps are drawn at the size they appear in the scene.
export const stamps = {
  ball: [
    '..kkk..','.koowk.','kolkowk','kwokwwk','kukkwwk','.kwwuk.','..kkk..',
  ],
  smallBall: ['.kk.','kook','kwok','.kk.'],
  star: ['...k...','...o...','kooook.','.wooow.','..ooo..','.ow.wo.','.k...k.'],
  cup: [
    '..kkkkkkk..','kkcoooowukk','kcclooowuwk','kwclooowuwk','.kklooowkk.','..kcoowuk..',
    '...kouwk...','....kok....','....kok....','...kwwwk...','..kccccck..','..kkkkkkk..',
  ],
  highTop: [
    '.kkkk.....','.kccbk....','.kccbk....','.kcssbk...','.kcccbkk..','.kbcsccck.',
    'kbbbccwwck','kccccccclk','.kkkkkkkk.',
  ],
  cap: ['...kkkk....','..kbbbsk...','.kbbttbbk..','.kbbbbbbkk.','kkbbkkkkcck','kkkk....kk.'],
  jersey: [
    '..kk...kk..','.kclkkklck.','kbcclllccbk','kbcccccccbk','.kccccccck.','..kccccck..',
    '..kccbcck..','..kccbcck..','..kccbcck..','..kccccck..','..kbbtbbk..','..kkkkkkk..',
  ],
  shirt: ['.k.k.','kccck','kccck','.kck.','.kkk.'],
  dribble: [
    '...kkk....','..kuuhk...','..khhkk...','...hh.....','..kbbkk...','.khbbbhk..',
    '.h.bcb.hh.','...bbbh..h','..kbbbk...','..kuckk...','..h...hk..','.hc...hc..','kkc...kkk.',
  ],
  guard: [
    '...kkk....','..kuuhk...','..khhhk...','...hh.....','.hkkrrkkh.','kh.krrk.hk',
    '...kcrk...','..krrrk...','..krrrkk..','.khk..hk..','.hh...kh..','kc.....cc.','kkk....kkk',
  ],
  shoot: [
    '.....hh...','....hh....','..h.hh....','.khhh.....','..h.kkk...','...kuuhk..',
    '...khhhk..','...kbbk...','...bbbk...','...bcbk...','..kbbbk...','..hh.hk...',
    '.kh..hh...','..cc..cc..',
  ],
  bust: [
    '....kkkk....','...kuuuuk...','..kuuukhhk..','..kuuhchhk..','..khuhhhkk..',
    '...khhhhk...','....khuuk...','...kchhck...','.kkbbccbkk..','kbbbblbbbbk.',
  ],
  backboard: [
    'kkkkkkkkkkkkk','kccccccccccck','kcsssssssssck','kcscccccscsck','kcsckkkcccsck',
    'kccckckcccsck','kkkkkkkkkkkkk','...roooooor..','....ckckck...','....kccck....','.....ckc.....',
  ],
  envelope: [
    'kkkkkkkkkkkkk','kcccllllccclk','kckccccccckck','kcckccccckcck','kccckccckccck',
    'kcccckkkcccck','kcckccccckcck','kckccccccckck','kkkkkkkkkkkkk',
  ],
  tag: ['.kkkkkk..','kclcccbk.','kckcccbk.','kcccbbbk.','.kccbbbk.','..kccbbk.','...kccbk.','....kkk..'],
  bolt: ['...kkk.','..kook.','.koook.','kookkk.','kkkoook','..kook.','.kook..','.kkk...'],
};

export function mark(g, name, x, y, options) {
  g.stamp(stamps[name], x, y, options);
}

export function pennant(g, x, y, width, height, face, tip) {
  g.box(x, y, width, height - 2, 'k');
  g.box(x + 1, y + 1, width - 2, height - 4, face);
  g.box(x + 1, y + height - 2, width - 2, 1, 'k');
  g.box(x + 2, y + height - 1, Math.max(1, width - 4), 1, 'k');
  g.box(x + 1, y + 1, width - 2, 1, tip);
  g.dot(x + (width >> 1), y + 3, tip);
}

export function fence(g, top, bottom, ink) {
  g.box(0, top, g.width, 1, ink);
  for (let y = top + 2; y < bottom; y++) {
    for (let x = 0; x < g.width; x++)
      if ((x + y - top) % 8 === 0 || (x - y + top + 80) % 8 === 0) g.dot(x, y, ink);
  }
}

export function blocks(g, y, sky, shadow) {
  const skyline = [[0,5,6],[5,8,10],[13,4,5],[17,8,8],[25,5,4],[30,6,11],[36,6,7]];
  for (const [x,width,height] of skyline) g.box(x,y-height,width,height,shadow);
  g.box(8,y-12,3,2,shadow); g.box(32,y-13,2,2,shadow);
  g.box(7,y-7,2,1,sky); g.box(10,y-7,1,1,sky); g.box(19,y-4,2,1,sky); g.box(33,y-7,1,2,sky);
}

export function arcadeFloor(g, y, floor = 'w', stripe = 'c') {
  g.box(0, y, g.width, g.height - y, floor);
  g.box(0, y, g.width, 1, 'k');
  g.line(0,y+5,g.width-1,y+5,stripe);
  g.line(3,g.height-1,14,y+5,stripe); g.line(g.width-4,g.height-1,g.width-14,y+5,stripe);
}

export function hoop(g, x, y, colors = {}) {
  g.box(x + 6, y + 6, 2, 11, colors.k ?? 'k');
  mark(g,'backboard',x,y,{colors});
}

export function notebook(g, x, y, w, h, ring = true) {
  g.box(x + 1,y + 2,w,h,'b');
  g.frame(x,y,w,h,'k','c');
  if (ring) {
    g.box(x+3,y+1,1,h-2,'t');
    for(let row=y+3;row<y+h-1;row+=6) g.box(x-1,row,4,1,'k');
  }
}

export function crossed(g,x,y,color) { g.stroke([[x,y],[x+2,y+2]],color); g.stroke([[x+2,y],[x,y+2]],color); }
export function ring(g,x,y,color) { g.stamp(['.1.','1.1','.1.'],x,y,{colors:{'1':color}}); }
