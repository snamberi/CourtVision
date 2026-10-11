// Court Vision's collectible illustrations, drawn on the same crisp SVG pixel
// grid as PixelIcon/PixelBall. Run `npm run relics:assets` to regenerate them.
// These checked-in files require no image service, font, or network at runtime.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../src/assets/relics/', import.meta.url));
const C = {
  ink: '#101623', deep: '#242d40', dark: '#38445a', steel: '#677a94', silver: '#acbfd0', white: '#edf4ed',
  goldDark: '#906024', gold: '#d99c36', sun: '#ffd467', cream: '#fff0b0',
  orangeDark: '#9c4426', orange: '#e57d30', peach: '#ffb459',
  blueDark: '#263e78', blue: '#417cce', cyan: '#75c9ec', ice: '#c8f5ff',
  purpleDark: '#49316e', purple: '#9160c4', lilac: '#d1a4f0',
  redDark: '#722f43', red: '#d55461', pink: '#ff94af',
  greenDark: '#25534b', green: '#48a787', mint: '#9ae5bd',
  woodDark: '#694735', wood: '#ab7547', tan: '#d4a469', paper: '#edcf91',
};
let parts = [];
const rect = (x, y, w, h, fill, opacity = 1) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity === 1 ? '' : ' opacity="' + opacity + '"'}/>`);
const path = (d, fill = C.ink, stroke, width = 1) => parts.push(`<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="miter"` : ''}/>`);
const line = (d, color = C.white, width = 1) => path(d, 'none', color, width);
const group = (transform, draw) => { parts.push(`<g transform="${transform}">`); draw(); parts.push('</g>'); };
const shine = (x, y, color = C.cream, size = 2) => { rect(x, y - size, 1, size * 2 + 1, color); rect(x - size, y, size * 2 + 1, 1, color); };
const stud = (x, y, color = C.silver) => { rect(x, y, 2, 2, C.ink); rect(x, y, 1, 1, color); };
const DIGITS = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'], '2':['111','001','111','100','111'],
  '3':['111','001','111','001','111'], '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '7':['111','001','010','010','010'], '8':['111','101','111','101','111'],
  '9':['111','101','111','001','111'], 'M':['101','111','111','101','101'], 'V':['101','101','101','101','010'],
  'P':['110','101','110','100','100'], 'H':['101','101','111','101','101'], 'O':['111','101','101','101','111'],
  'F':['111','100','110','100','100'], 'Z':['111','001','010','100','111'], '?':['111','001','010','000','010'],
  '+':['000','010','111','010','000'], '.':['0','0','0','0','1'],
};
function text(value, x, y, color = C.white, scale = 1) {
  for (const char of value) {
    const rows = DIGITS[char];
    if (!rows) { x += 3 * scale; continue; }
    rows.forEach((row, iy) => [...row].forEach((v, ix) => { if (v === '1') rect(x + ix * scale, y + iy * scale, scale, scale, color); }));
    x += (rows[0].length + 1) * scale;
  }
}
function disc(cx, cy, radius, colors = [C.ink, C.orangeDark, C.orange, C.peach]) {
  // Integer scanlines, merged by color: round silhouettes remain pixel art at any size.
  const runs = new Map();
  for (let y = -radius; y <= radius; y++) {
    let last = '', start = -radius;
    const flush = x => { if (last) runs.set(last, (runs.get(last) ?? '') + `M${cx + start} ${cy + y}h${x - start}v1h${start - x}z`); };
    for (let x = -radius; x <= radius + 1; x++) {
      const distance = Math.hypot(x, y);
      const col = distance > radius || x > radius ? '' : distance > radius - 1.5 ? colors[0]
        : x + y > radius * .45 ? colors[1] : x + y < -radius * .42 ? colors[3] : colors[2];
      if (col !== last) { flush(x); start = x; last = col; }
    }
  }
  for (const [fill, d] of runs) path(d, fill);
}
function ball(cx = 24, cy = 24, radius = 14, golden = false, old = false) {
  const palette = golden ? [C.ink, C.goldDark, C.gold, C.sun] : old ? [C.ink, C.woodDark, C.wood, C.tan] : undefined;
  disc(cx, cy, radius, palette);
  const seam = golden ? C.goldDark : old ? C.woodDark : C.woodDark;
  line(`M${cx} ${cy - radius + 2}V${cy + radius - 1}M${cx - radius + 2} ${cy}H${cx + radius - 1}`, seam, 1.5);
  line(`M${cx - 8} ${cy - radius + 4}v4h2v5h1v4h-1v5h-2v3M${cx + 8} ${cy - radius + 4}v4h-2v5h-1v4h1v5h2v3`, seam);
  rect(cx - 6, cy - radius + 4, 4, 1, golden ? C.cream : old ? C.paper : C.paper);
  for (const [x,y] of [[-8,-3],[4,-7],[8,5],[-5,8],[3,4]]) rect(cx + x, cy + y, 1, 1, golden ? C.sun : C.peach, .65);
  if (old) { rect(cx - 6, cy - 3, 12, 4, C.woodDark); for (let x = -5; x <= 5; x += 3) rect(cx + x, cy - 2, 1, 2, C.paper); }
}
function paper(fill = C.paper, folded = false) {
  path('M11 5H33V8H37V42H11Z', C.ink); rect(13,7,20,33,fill); rect(33,10,2,30,C.tan);
  path('M29 7H33V11H29Z', C.white); rect(14,8,1,28,C.white,.45);
  if (folded) { line('M14 19H32M23 9V38', C.wood, 1); line('M15 20H32M24 9V38', C.white, 1); }
}
function signature(x, y, color = C.ink) { line(`M${x} ${y+3}l3 -4v6l4 -5l-1 5l5 -4v3h4l2 -2`, color); }
function star(cx, cy, fill = C.sun, s = 1) {
  group(`translate(${cx-7*s} ${cy-7*s}) scale(${s})`, () => path('M6 0H8V4H10V5H14V7H11V9H12V13H9V11H5V13H2V9H3V7H0V5H4V4H6Z', fill, C.ink, 1));
}
function jersey(color = C.blue, trim = C.sun, number = '30', framed = false) {
  if (framed) { rect(4,2,40,44,C.ink); rect(6,4,36,40,C.goldDark); rect(8,6,32,36,C.deep); rect(7,5,33,1,C.sun); }
  path('M16 7H20V11H28V7H32L41 14V22H34V40H14V22H7V14Z', C.ink);
  path('M16 9H19V13H29V9H32L38 15V19H32V38H16V19H10V15Z',color);
  path('M17 9H19V13H29V9H31V15H17Z',trim); rect(17,16,2,20,C.white,.22); rect(16,35,16,2,trim);
  text(number,number.length>1?20:22,22,C.white,1); rect(29,18,2,4,C.white); rect(30,18,1,2,C.red);
}
function jacket(color, trim, formal = false) {
  path('M17 7H31L35 11H38L43 34L36 36L33 24V41H15V24L12 36L5 34L10 11H13Z',C.ink);
  path('M17 9H31L34 13H36L40 32H37L31 18V39H17V18L11 32H8L12 13H15Z',color);
  rect(23,13,2,26,C.ink); rect(17,34,6,2,trim);rect(26,34,5,2,trim);rect(17,37,14,2,trim);
  if(formal){path('M18 9H23V16L20 20L17 12ZM25 9H30L32 12L28 20L25 16Z',trim);rect(26,24,4,1,C.gold);star(29,18,C.sun,.45);}
  else{rect(13,14,2,11,trim);rect(33,14,2,11,trim);path('M18 9H22V13H18ZM26 9H30V13H26Z',trim);text('1',27,19,trim);}
  rect(19,15,1,14,C.white,.22);stud(24,23,C.silver);stud(24,30,C.silver);
}
function shoe(color = C.gold, trim = C.white, signed = false) {
  path('M8 17H18V23H21V26H26V28H37V31H41V39H5V25H8Z',C.ink);
  path('M10 19H16V25H20V28H25V30H36V32H38V35H8V27H10Z',color);
  rect(8,35,30,2,trim);rect(9,37,29,1,C.steel);rect(11,20,4,5,trim);rect(9,29,2,4,C.white,.3);
  line('M18 25H22M20 28H25M24 30H28',trim,1);path('M13 29H18V31H15V33H12Z',C.ink);
  if(signed) signature(23,31,C.ink); else rect(29,31,5,1,C.white,.45);
}
function ticket(color = C.paper, season = false) {
  path('M5 14H43V21H40V27H43V35H5V28H8V22H5Z',C.ink);
  path('M7 16H41V19H38V29H41V33H7V30H10V20H7Z',color);
  rect(12,16,2,17,season?C.goldDark:C.orangeDark); rect(17,19,12,2,season?C.goldDark:C.blueDark);
  text(season?'41':'ZZ',17,23,C.ink);
  for(let y=18;y<33;y+=3)rect(32,y,1,1,C.woodDark);
  for(let x=35;x<39;x+=2)rect(x,21,1,8,C.woodDark);
  rect(18,30,9,1,C.white); if(season)star(36,11,C.sun,.6);
}
function clipboard(whiteboard = false) {
  rect(8,7,32,35,C.ink);rect(10,9,28,31,whiteboard?C.silver:C.wood);rect(12,11,24,27,C.paper);
  rect(17,4,14,7,C.ink);rect(19,5,10,4,C.silver);rect(20,5,7,1,C.white);
  line('M14 16H34V35H14ZM24 16V35M14 23H19V29H14',whiteboard?C.blue:C.wood,1);
  for(const [x,y] of [[17,19],[25,29],[29,23]]){rect(x,y,3,3,C.blueDark);rect(x+1,y+1,1,1,C.paper);}
  line('M19 30l3 -3m-3 0l3 3M29 19l3 3m0 -3l-3 3',C.red,1);
  line('M20 22h7v5h5m-2 -2l2 2l-2 2',C.red,1); if(whiteboard){rect(6,39,36,3,C.steel);rect(29,39,9,2,C.red);}
}
function book(color=C.purpleDark, open=false) {
  if(open){path('M4 10H21L24 13L27 10H44V39H27L24 41L21 39H4Z',C.ink);rect(6,12,15,25,C.paper);rect(27,12,15,25,C.paper);path('M21 12L24 15L27 12V38L24 39L21 37Z',C.tan);for(let y=17;y<33;y+=4){rect(9,y,9,1,C.wood);rect(30,y,8,1,C.wood);}signature(29,32,C.blueDark);}
  else{path('M10 6H37V41H10L7 38V9Z',C.ink);rect(11,8,24,28,color);rect(9,9,3,28,C.woodDark);rect(12,37,23,2,C.paper);rect(13,38,20,1,C.tan);rect(13,9,1,24,C.white,.2);rect(17,13,14,2,C.sun);rect(17,29,13,1,C.sun);star(24,22,C.sun,.6);rect(29,36,3,7,C.red);}
}
function ribbon(fill=C.blue, number='30') {
  rect(8,6,32,3,C.ink);rect(10,5,28,1,C.gold);path('M12 9H36V36L24 43L12 36Z',C.ink);
  path('M14 10H34V35L24 40L14 35Z',fill);rect(16,11,16,2,C.sun);rect(16,13,1,18,C.white,.25);text(number,number.length>1?20:22,21,C.white);line('M16 34l8 5l8 -5',C.sun);star(24,17,C.sun,.5);
}
function net(gold=false,torn=false,bent=false){
  const rope=gold?C.sun:C.silver;
  path(bent?'M6 11H18V14H30V11H42V17H30V19H18V16H6Z':'M6 10H42V16H6Z',C.ink);
  rect(8,11,32,2,gold?C.sun:C.orange);rect(9,13,30,1,gold?C.goldDark:C.orangeDark);
  for(let i=0;i<6;i++)line(`M${10+i*5} 16l${i<3?5:-5} ${torn&&i>3?12:22}`,rope,1);
  for(let y=19;y<36;y+=5){const inset=(y-15)/3;line(`M${9+Math.round(inset)} ${y}H${39-Math.round(inset)}`,rope,1);}
  if(torn){path('M24 24H33V29H29V35H23Z','none');rect(28,26,6,8,C.ink);line('M22 34v5h-3M29 24v6h3M16 37v4',C.white,1);}
  else line('M15 38H33',gold?C.cream:C.white);
  if(gold){shine(7,24,C.cream);shine(38,33,C.sun);}
}
function coin(cx,cy,r=9,color=C.gold){disc(cx,cy,r,[C.ink,C.goldDark,color,C.sun]);line(`M${cx-r+3} ${cy-2}v5h2M${cx+r-3} ${cy-4}v7`,C.cream);text('1',cx-1,cy-2,C.goldDark);}
function ring(gem=C.ice,royal=false){
  disc(24,27,14,[C.ink,C.goldDark,C.gold,C.sun]);disc(24,29,8,[C.goldDark,C.ink,C.ink,C.ink]);
  path('M14 11H18V7H30V11H34V22H14Z',C.ink);rect(16,12,16,8,C.gold);rect(19,9,10,3,C.sun);
  path('M19 12H29L31 15L26 21H22L17 15Z',gem);path('M19 12H25L22 17L17 15Z',C.white);path('M25 12H29L31 15L26 21H24Z',royal?C.green:C.cyan);
  rect(11,26,2,8,C.sun);rect(16,36,4,2,C.sun);shine(35,11,C.cream);
  if(royal){for(const x of [13,21,29]){rect(x,39,6,3,C.goldDark);rect(x+1,39,4,1,C.sun);}star(24,5,C.sun,.4);}
}
function trophy(allstar=false){
  rect(11,39,27,4,C.ink);rect(13,37,23,4,C.goldDark);rect(15,37,18,1,C.sun);
  path('M21 18H29V21H27V32H32V36H16V32H21Z',C.ink);path('M23 18H27V23H25V33H30V34H18V33H23Z',C.gold);rect(23,21,1,10,C.cream);
  if(allstar){star(24,14,C.sun,1.35);disc(24,15,3,[C.goldDark,C.gold,C.sun,C.cream]);}
  else{ball(24,13,9,true);line('M29 22l4 -3v-4',C.goldDark,3);}
  rect(20,39,9,2,C.cream);
}

const ART = {
  netScrap(){net(false,true);},
  chalkBag(){
    path('M17 12H31L29 19L36 28V39H12V28L19 19Z',C.ink);path('M19 14H29L26 21L33 29V36H15V29L22 21Z',C.silver);
    path('M17 28H21V35H30V37H15V29Z',C.steel);rect(19,20,11,3,C.blueDark);rect(21,14,2,5,C.white);line('M28 22h5v5',C.blue);
    rect(20,28,9,5,C.white);for(const[x,y]of[[12,8],[23,5],[33,10],[36,18],[15,17]])rect(x,y,2,2,C.white);shine(28,8,C.ice,1);
  },
  rookieCard(){paper(C.paper,true);rect(16,11,15,20,C.blueDark);rect(18,13,11,1,C.cyan);rect(21,16,6,6,C.tan);rect(19,22,10,8,C.orange);text('1',22,24,C.white);rect(16,34,14,2,C.woodDark);path('M12 7H18L13 12Z',C.tan);},
  wristband(){path('M10 17L15 12H34L39 17V32L34 37H15L10 32Z',C.ink);path('M13 18H35V31H13Z',C.white);rect(15,14,18,3,C.silver);rect(13,21,22,5,C.blue);rect(13,28,22,2,C.red);rect(15,33,18,2,C.steel);for(let x=15;x<34;x+=3)rect(x,18,1,13,C.ink,.1);},
  ticketStub(){ticket();},
  whistle(){line('M27 12h7v-5h-8v9M33 7h6v8h-6',C.silver,2);path('M13 17H26V20H39V28H27V35H13L8 30V22Z',C.ink);path('M14 19H24V23H37V26H24V32H14L11 29V23Z',C.silver);rect(14,21,8,3,C.white);rect(16,25,5,5,C.steel);rect(29,23,8,1,C.white);rect(10,37,2,3,C.cyan);rect(5,32,2,2,C.cyan);},
  clipboard(){clipboard();},
  gameBall(){ball();signature(14,27,C.white);rect(29,30,4,1,C.white);},
  warmups(){group('translate(4 4) scale(.85)',()=>{path('M13 21H32L37 43H26L23 31L21 43H10Z',C.blueDark);jacket(C.blue,C.white);});},
  floorboard(){path('M5 18L33 6L43 13V32L15 43L5 36Z',C.ink);path('M7 19L33 9L40 14L15 25Z',C.tan);path('M7 21L15 27V40L7 35Z',C.woodDark);path('M17 27L40 17V31L17 40Z',C.wood);line('M11 18l22 -8M17 22l20 -8M21 30l15 -6M19 35l18 -7',C.woodDark);path('M21 14L25 12L31 18L27 20Z',C.paper);stud(19,29,C.steel);stud(35,28,C.steel);},
  goldShoes(){group('translate(3 -6) scale(.86)',()=>shoe(C.goldDark,C.sun));shoe(C.gold,C.cream);shine(35,17,C.cream);},
  banner(){ribbon(C.blueDark,'30');},
  champagne(){path('M20 5H28V18L32 23V41H16V23L20 18Z',C.ink);rect(22,7,4,13,C.gold);rect(21,8,6,5,C.sun);path('M22 18H26V21L30 25V39H18V25L22 21Z',C.greenDark);rect(20,25,8,10,C.paper);rect(21,28,6,1,C.goldDark);star(24,31,C.gold,.35);rect(18,27,1,10,C.green);rect(32,8,5,3,C.wood);line('M31 18l5 -4M13 14l-3 -4',C.sun);shine(35,24,C.cream,1);},
  scoutNotes(){book(C.purpleDark,true);line('M32 10l8 21',C.ink,3);line('M33 10l8 20',C.gold,1);rect(38,29,3,5,C.ink);star(13,24,C.blue,.6);},
  ring(){ring();},
  trophy(){trophy();},
  mvpBall(){rect(11,36,26,7,C.ink);rect(13,37,22,4,C.purpleDark);ball(24,20,14,true);text('MVP',18,38,C.sun);shine(38,12,C.cream);},
  firstBall(){ball(24,24,15,false,true);rect(15,40,20,3,C.deep);text('1891',17,39,C.paper);shine(7,12,C.lilac);shine(40,32,C.lilac,1);},
  peachBasket(){path('M7 15H41L36 42H12Z',C.ink);path('M10 18H38L33 39H15Z',C.wood);rect(8,13,32,5,C.woodDark);rect(10,14,28,2,C.tan);for(let y=22;y<38;y+=5)line(`M${12+Math.floor((y-22)/7)} ${y}H${36-Math.floor((y-22)/7)}`,C.paper);for(let x=15;x<36;x+=5)line(`M${x} 19l${x<24?2:-2} 19`,C.woodDark);rect(17,38,14,1,C.tan);shine(7,30,C.lilac);},
  benchTowel(){path('M10 9H35V39H30V43H10Z',C.ink);rect(12,11,21,28,C.paper);rect(28,11,5,29,C.tan);rect(12,14,21,3,C.orange);rect(12,33,21,3,C.orange);rect(14,20,1,10,C.white);line('M17 19v10M22 21v9',C.tan);for(let x=13;x<33;x+=3)rect(x,39,1,3,C.paper);},
  headband(){path('M8 17H12V13H36V17H40V32H36V35H12V32H8Z',C.ink);rect(12,16,24,15,C.silver);rect(15,18,18,8,C.ink);rect(10,23,28,8,C.white);rect(11,25,26,3,C.red);rect(15,32,18,1,C.steel);star(24,27,C.sun,.35);},
  gameProgram(){book(C.blueDark);text('24',20,19,C.white);rect(17,26,14,1,C.cyan);rect(16,13,17,2,C.orange);},
  foamFinger(){path('M16 5H23V20H27V16H34V20H38V36L33 42H15L10 34V23H16Z',C.ink);path('M18 7H21V24H27V18H32V22H36V34L32 39H17L12 33V25H17Z',C.red);rect(18,8,2,14,C.pink);text('1',22,26,C.white,2);line('M29 23v7M33 24v7',C.redDark);},
  bobblehead(){rect(13,39,23,4,C.ink);rect(15,39,19,2,C.gold);rect(22,31,4,8,C.steel);line('M20 31h8v2h-8v2h8',C.silver);path('M16 26H32V35H16Z',C.blueDark);rect(19,26,10,9,C.blue);text('1',22,28,C.sun);path('M15 8H33V12H36V23H33V27H15V23H12V12H15Z',C.ink);rect(15,12,18,11,C.tan);rect(17,9,14,5,C.deep);rect(18,17,3,2,C.white);rect(27,17,3,2,C.white);rect(20,22,9,1,C.woodDark);rect(19,17,1,2,C.ink);rect(28,17,1,2,C.ink);},
  mouthguard(){path('M10 13H17V26H20V29H28V26H31V13H38V29L32 37H16L10 29Z',C.ink);path('M12 15H15V28H19V32H29V28H33V15H36V28L31 34H17L12 28Z',C.ice);path('M13 26H16V30H20V33H29V30H33V26H35V30L30 36H18L13 30Z',C.cyan);rect(13,15,2,7,C.white);rect(33,15,2,6,C.white);line('M20 31v3M25 31v3M30 28v5',C.blue);},
  scoreSheet(){paper(C.white);rect(16,12,15,3,C.blueDark);for(let y=19;y<37;y+=4)rect(16,y,15,1,C.steel);for(let x=20;x<31;x+=5)rect(x,18,1,20,C.silver);text('30',22,22,C.red);line('M9 28l10 -12',C.ink,3);line('M9 27l10 -12',C.orange);},
  clockBulb(){disc(24,19,12,[C.ink,C.goldDark,C.sun,C.cream]);rect(17,28,15,8,C.ink);rect(19,29,11,5,C.steel);for(let y=30;y<37;y+=3)rect(19,y,11,1,C.silver);rect(21,37,7,3,C.ink);line('M20 19l3 5l3 -5l3 4',C.orangeDark);line('M24 24v5',C.woodDark);shine(8,8,C.sun,1);},
  luckyPenny(){coin(24,24,16,C.wood);rect(21,17,6,10,C.orangeDark);text('1',22,19,C.paper);shine(38,10,C.cream,1);},
  luckySocks(){group('translate(12 -3)',()=>{path('M11 8H23V28H29V38H12L7 33V25H11Z',C.ink);path('M13 10H21V30H27V36H14L9 32V27H13Z',C.silver);rect(13,13,8,3,C.red);});path('M9 12H22V30H29V41H12L6 35V29H9Z',C.ink);path('M11 14H20V33H27V39H13L8 34V31H11Z',C.white);rect(11,17,9,3,C.blue);rect(11,23,9,2,C.sun);rect(21,34,6,5,C.silver);},
  paradeConfetti(){path('M13 23L35 36L11 43Z',C.ink);path('M15 26L31 36L13 40Z',C.purple);line('M18 28l-3 9M24 32l-4 6',C.sun,2);for(const[x,y,c]of[[9,10,C.red],[18,6,C.sun],[30,11,C.cyan],[37,23,C.mint],[22,20,C.pink],[8,23,C.blue],[34,5,C.purple]]){rect(x,y,3,5,c);rect(x+2,y+4,3,2,c);}shine(33,29,C.sun,1);},
  fanAutograph(){path('M9 11H35L39 14V39H12L8 34Z',C.ink);path('M11 13H34L37 16V37H13L10 33Z',C.paper);line('M13 15v18M15 16h18M14 35h20',C.tan);signature(15,23,C.blueDark);line('M14 31h18',C.blueDark);path('M30 12L34 9L41 30L37 32Z',C.ink);line('M34 12l6 17',C.orange);},
  pressPass(){line('M17 17L12 5H36L31 17',C.blue,3);rect(11,16,26,27,C.ink);rect(13,18,22,23,C.white);rect(13,18,22,5,C.blueDark);rect(17,26,8,10,C.silver);rect(19,27,4,4,C.tan);rect(18,32,6,4,C.blue);rect(28,27,4,1,C.steel);rect(28,30,4,1,C.steel);for(let x=17;x<32;x+=2)rect(x,38,1,2,C.ink);rect(21,17,6,1,C.silver);},
  lockerPlate(){path('M4 15H44V34H4Z',C.ink);rect(6,17,36,15,C.steel);rect(7,18,34,2,C.silver);rect(9,22,30,7,C.deep);text('30',20,23,C.sun);for(const[x,y]of[[7,20],[39,20],[7,29],[39,29]])stud(x,y);rect(7,32,34,1,C.ink);},
  playbook(){book(C.redDark);line('M17 18h10v7h-4m2 -2l-2 2l2 2',C.white);rect(29,17,3,3,C.cyan);line('M17 26l3 -3m-3 0l3 3',C.white);},
  draftCap(){path('M11 26V17L16 11H29L35 17V27H42V33H25L20 36H6V29Z',C.ink);path('M13 25V18L18 13H28L33 18V27H14Z',C.blue);path('M12 28H33V29H39V31H24L18 33H8V30Z',C.blueDark);rect(21,13,1,13,C.cyan);star(25,23,C.sun,.5);rect(27,29,7,2,C.sun);rect(20,10,6,2,C.ink);},
  allStarJersey(){jersey(C.red,C.sun,'24');star(25,17,C.sun,.5);},
  tunnelSign(){rect(6,10,36,28,C.ink);rect(8,12,32,24,C.blueDark);rect(10,14,28,20,C.gold);rect(12,16,24,16,C.deep);star(18,24,C.sun,.6);path('M26 21H31V18L36 24L31 30V27H26Z',C.white);for(const[x,y]of[[9,13],[37,13],[9,33],[37,33]])stud(x,y);rect(13,30,8,1,C.orange);},
  tipoffBall(){ball(24,28,12);path('M21 10V5H18L24 0L30 5H27V10Z',C.blue);line('M9 15v8M38 15v8',C.cyan);rect(6,25,2,4,C.blue);rect(40,25,2,4,C.blue);},
  signedSneaker(){shoe(C.white,C.red,true);rect(11,21,3,4,C.red);},
  rookiePack(){path('M12 5H36V43H12Z',C.ink);rect(14,7,20,34,C.blueDark);rect(15,9,18,29,C.blue);path('M15 11H32V14H28V18H23V22H18Z',C.cyan);rect(14,7,20,3,C.silver);rect(14,38,20,3,C.silver);for(let x=15;x<34;x+=3){rect(x,7,1,3,C.steel);rect(x,38,1,3,C.steel);}star(24,24,C.sun);rect(17,34,13,1,C.white);},
  seasonTicket(){group('translate(-1 -5)',()=>ticket(C.goldDark));ticket(C.sun,true);},
  benchChain(){line('M10 11v10h3v6h5v4h12v-4h5v-6h3V11',C.ink,5);line('M10 11v10h3v6h5v4h12v-4h5v-6h3V11',C.gold,3);for(const[x,y]of[[10,13],[11,22],[16,28],[32,28],[37,19]])rect(x,y,2,2,C.cream);disc(24,34,8,[C.ink,C.goldDark,C.gold,C.sun]);text('1',23,32,C.ink);},
  bentRim(){net(false,false,true);path('M8 8H12V14H8Z',C.silver);rect(8,8,2,3,C.white);rect(38,13,4,4,C.orangeDark);},
  buzzerClock(){rect(4,12,40,25,C.ink);rect(6,14,36,21,C.steel);rect(8,16,32,16,C.deep);text('0.0',11,18,C.red,2);rect(8,14,32,1,C.red);rect(10,34,28,1,C.redDark);line('M6 7l-2 -3M24 8V3M42 7l2 -3',C.sun,2);},
  coachTie(){path('M16 5H32L29 15L27 18L32 36L24 44L16 36L21 18L18 15Z',C.ink);path('M18 7H30L27 14H21Z',C.purple);path('M23 17H25L29 35L24 40L19 35Z',C.purple);path('M20 30L27 25L28 29L20 35ZM22 19L26 16L27 20L21 24Z',C.sun);rect(20,8,8,1,C.lilac);},
  allStarMvp(){trophy(true);},
  streakBall(){path('M10 35H38V17L34 20L32 7L25 15L20 3L17 19L10 13Z',C.redDark);path('M13 29H35V21L29 26L26 12L20 22L18 16Z',C.orange);ball(24,29,12);text('33',21,26,C.cream);shine(39,8,C.sun,1);},
  iceBag(){path('M17 10H31V17L37 25V41H11V25L17 17Z',C.ink);path('M19 12H29V19L35 26V39H13V26L19 19Z',C.blueDark);rect(17,8,14,5,C.silver);rect(19,8,10,2,C.white);for(const[x,y]of[[16,25],[25,22],[22,32],[28,30]]){rect(x,y,6,6,C.cyan);rect(x+1,y+1,3,1,C.ice);rect(x,y+5,6,1,C.blue);}shine(7,24,C.ice,1);shine(39,16,C.cyan,1);},
  bannerThread(){ribbon(C.purpleDark,'1');path('M12 31H24V43H12Z',C.ink);line('M19 30v5h-4v5h5v-4h5v6h9v-5h-3',C.sun,2);rect(19,29,2,2,C.cream);},
  hofBallot(){paper(C.white);rect(16,11,15,8,C.goldDark);text('HOF',18,13,C.sun);for(const y of [24,31]){rect(16,y,4,4,C.steel);rect(17,y+1,2,2,C.white);rect(23,y+1,8,1,C.steel);}line('M16 25l2 2l4 -6',C.green,2);rect(25,36,6,3,C.red);},
  game7Ball(){ball();path('M30 29H43V42H30Z',C.ink);rect(32,31,9,9,C.gold);text('7',35,33,C.ink);shine(8,10,C.sun,1);},
  retiredJersey(){jersey(C.red,C.white,'23',true);},
  dynastyRing(){ring(C.mint,true);},
  fluSneakers(){group('translate(5 -6) scale(.86)',()=>shoe(C.ink,C.red));shoe(C.red,C.ink);rect(11,22,3,4,C.ink);text('23',27,31,C.white);},
  lastWhiteboard(){clipboard(true);star(36,6,C.sun,.5);},
  hofJacket(){jacket(C.orange,C.goldDark,true);},
  goldenNet(){net(true);shine(23,5,C.pink,1);},
  firstJumpBall(){rect(12,38,24,5,C.ink);rect(15,36,18,4,C.goldDark);ball(24,22,12,false,true);path('M6 17H9V13H12L8 8L4 13H6ZM39 17H42V13H44L40 8L36 13H39Z',C.lilac);line('M9 30h3M36 30h3',C.purple);shine(24,4,C.cream,1);},
  gavel(){rect(21,37,22,7,C.ink);rect(23,36,18,5,C.woodDark);rect(25,36,14,2,C.tan);group('rotate(-35 24 24)',()=>{rect(21,16,7,27,C.ink);rect(23,18,3,23,C.wood);rect(9,7,31,13,C.ink);rect(11,9,27,9,C.goldDark);rect(13,10,23,3,C.gold);rect(11,9,4,9,C.sun);rect(34,9,4,9,C.sun);rect(22,10,6,6,C.purpleDark);});shine(39,7,C.pink,1);},
  eternalSpin(){disc(24,24,19,[C.ink,C.goldDark,C.gold,C.sun]);disc(24,24,14,[C.ink,C.purpleDark,C.purpleDark,C.deep]);for(const[x,y]of[[22,7],[36,22],[22,37],[8,22]])rect(x,y,3,3,C.cream);line('M12 24l5 -5h4l6 10h4l5 -5l-5 -5h-4l-6 10h-4Z',C.ice,2);path('M36 8H43V15H40V12H36Z',C.cyan);shine(7,9,C.cream);},
  secondWind(){path('M20 17L5 10V22L11 28H18M28 17L43 10V22L37 28H30',C.ink);path('M18 18L7 13V20L12 25H19M30 18L41 13V20L36 25H29',C.white);line('M8 18l10 6M40 18l-10 6',C.cyan,2);path('M17 17H23V20H25V17H31L35 22V29L24 40L13 29V22Z',C.ink);path('M18 19H22V22H26V19H30L33 23V28L24 37L15 28V23Z',C.green);line('M19 24h4v5h5',C.mint,2);line('M10 34H5M12 38H8M38 34H43',C.cyan,2);},
  goldenTouch(){path('M16 40V30L9 23V17H14L20 23V9H25V21H27V7H32V22H34V12H39V30L31 40Z',C.ink);path('M18 38V29L11 22V19H13L22 28V11H23V25H29V9H30V25H36V14H37V29L30 38Z',C.gold);rect(20,30,11,6,C.sun);coin(10,11,7);shine(40,7,C.cream);shine(40,37,C.cream,1);},
  ironWill(){path('M24 3L41 9V25L35 35L24 45L13 35L7 25V9Z',C.ink);path('M24 6L38 11V25L32 34L24 41L16 34L10 25V11Z',C.silver);path('M24 10L34 14V25L29 32L24 37L19 32L14 25V14Z',C.deep);path('M23 16H27V24H30L24 33L18 24H22Z',C.orange);rect(23,18,2,8,C.sun);for(const[x,y]of[[11,13],[35,13],[14,29],[32,29]])stud(x,y,C.white);},
  extraPick(){rect(5,11,24,29,C.ink);rect(7,13,20,25,C.blueDark);rect(12,7,24,29,C.ink);rect(14,9,20,25,C.blue);rect(20,4,23,29,C.ink);rect(22,6,19,25,C.paper);rect(25,9,13,7,C.blueDark);text('1',29,10,C.sun);rect(25,20,10,1,C.wood);rect(25,24,8,1,C.wood);disc(35,35,9,[C.ink,C.greenDark,C.green,C.mint]);text('+',32,30,C.white,2);},
  clutchGene(){line('M16 5v7l16 22v9M32 5v7L16 34v9',C.ink,5);line('M16 5v7l16 22v9',C.red,3);line('M32 5v7L16 34v9',C.cyan,3);for(const[y,w]of[[7,14],[13,10],[19,4],[29,4],[35,10],[41,14]]){line(`M${24-w/2} ${y}h${w}`,C.white,1);rect(24,y,1,1,C.sun);}shine(39,17,C.red,1);},
  ownersFavorite(){path('M9 7H36V40H9Z',C.ink);rect(11,9,23,29,C.purpleDark);rect(13,10,1,26,C.purple);path('M16 16H20V20H23V14H26V20H29V16H32V26H16Z',C.gold);rect(18,24,12,2,C.sun);rect(17,30,12,1,C.sun);disc(33,34,7,[C.ink,C.goldDark,C.gold,C.sun]);rect(35,35,3,9,C.gold);rect(36,40,5,2,C.gold);rect(38,43,3,2,C.gold);disc(32,32,2,[C.goldDark,C.ink,C.ink,C.ink]);shine(38,8,C.sun,1);},
  lastLook(){line('M4 16V7H13M35 7H44V16M4 32V41H13M35 41H44V32',C.gold,2);path('M6 24L14 15H34L42 24L34 33H14Z',C.ink);path('M9 24L16 18H32L39 24L32 30H16Z',C.white);disc(24,24,8,[C.ink,C.blueDark,C.blue,C.cyan]);disc(24,24,4,[C.blueDark,C.ink,C.ink,C.ink]);rect(22,20,3,3,C.white);rect(28,27,2,2,C.ice);rect(20,38,2,2,C.cyan);rect(24,38,2,2,C.cyan);rect(28,38,2,2,C.cyan);},
  mystery(){path('M15 7H33V12H39V37H33V42H15V37H9V12H15Z',C.ink);path('M17 10H31V15H36V34H31V39H17V34H12V15H17Z',C.deep);line('M17 11h13M13 16v16M18 37h12',C.steel);text('?',18,17,C.silver,2);rect(14,12,2,2,C.goldDark);rect(32,34,2,2,C.goldDark);},
};

// Stop regeneration if a newly added collectible has not been illustrated yet.
const catalog = readFileSync(new URL('../src/relics/relics.ts', import.meta.url), 'utf8');
const catalogParts = ['RELICS: Relic[]', 'SECRET_RELICS: SecretRelic[]'].map(marker => catalog.split(`export const ${marker} = [`)[1].split('];')[0]);
const ids = catalogParts.flatMap(s => [...s.matchAll(/\bid: '([^']+)'/g)].map(m => m[1]));
const missing = ids.filter(id => !ART[id]);
const extra = Object.keys(ART).filter(id => id !== 'mystery' && !ids.includes(id));
if (missing.length || extra.length) throw new Error(`Relic artwork mismatch. Missing: ${missing.join(', ')}. Extra: ${extra.join(', ')}`);
mkdirSync(output, { recursive: true });
for (const [id, draw] of Object.entries(ART)) {
  parts = [];
  path('M12 43H36V45H12Z', C.ink);
  draw();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="192" height="192" shape-rendering="crispEdges">${parts.join('')}</svg>\n`;
  writeFileSync(`${output}/relic-${id}.svg`, svg);
}
console.log(`Drew ${ids.length} unique relic illustrations plus the sealed-relic placeholder.`);
