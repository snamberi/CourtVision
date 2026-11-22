import { PixelGrid } from './pixels.mjs';
import { arcadeFloor, blocks, crossed, fence, hoop, mark, notebook, pennant, ring } from './stamps.mjs';

function playDiagram(g, x, y, face, ink, pieces) {
  g.frame(x,y,21,23,ink,face);
  g.box(x+8,y+1,5,5,ink); g.box(x+9,y+1,3,4,face);
  g.stroke([[x+3,y+1],[x+3,y+6],[x+6,y+10],[x+14,y+10],[x+17,y+6],[x+17,y+1]],ink);
  ring(g,x+4,y+15,pieces); ring(g,x+14,y+11,pieces); crossed(g,x+14,y+17,ink);
  g.stroke([[x+7,y+16],[x+10,y+13],[x+10,y+7]],pieces);
  g.stroke([[x+8,y+9],[x+10,y+7],[x+12,y+9]],pieces);
}

// Seven scanlines keep all four characters inside the centre of an angled card.
const boardDigits = [
  ['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
  ['.###.','#...#','....#','...#.','..#..','.#...','#####'],
  ['...','...','...','###','...','...','...'],
  ['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
];

function score(g, x, y, digital) {
  g.frame(x,y,34,18,'k','b');
  let col = x + 4;
  if (digital) {
    g.frame(x+2,y+2,30,14,'s','k');
    g.dot(x+1,y+1,'c'); g.dot(x+32,y+16,'s');
  }
  for (const glyph of boardDigits) {
    const width = glyph[0].length;
    if (!digital) {
      g.box(col-1,y+3,width+2,12,'c');
      g.box(col,y+2,1,2,'s');
    }
    g.stamp(glyph,col,y+6,{colors:{'#':digital?'o':'k'}});
    col += width+3;
  }
}

function shoeBench(g, floor, trim) {
  g.box(0,33,40,15,floor);
  g.box(0,34,40,4,'k'); g.box(0,34,40,2,trim);
  g.box(5,38,2,8,'k'); g.box(32,38,2,8,'k');
}

function fieldhouse(g, name) {
  switch (name) {
    case 'franchise':
      g.box(0,0,40,48,'d'); g.box(0,28,40,20,'w'); g.line(0,31,39,31,'u');
      pennant(g,3,-2,6,10,'b','s'); pennant(g,11,-3,6,9,'r','c');
      g.box(7,11,25,29,'u'); g.frame(6,9,25,30,'k','o');
      playDiagram(g,8,13,'b','c','o');
      g.frame(13,7,10,4,'k','s'); g.box(15,8,6,1,'c');
      g.line(32,31,36,18,'k'); g.line(33,31,37,18,'c'); g.dot(32,32,'k');
      break;
    case 'legends':
      g.box(0,0,40,48,'d'); g.box(0,8,40,2,'b');
      pennant(g,0,-1,10,17,'r','o'); pennant(g,15,-4,9,15,'b','c'); pennant(g,30,-1,10,17,'t','c');
      g.box(0,35,40,13,'b'); g.box(4,37,32,7,'k'); g.box(5,37,30,2,'w');
      mark(g,'cup',9,12,{scale:2}); g.box(12,41,16,2,'o');
      break;
    case 'career':
      g.box(0,0,40,48,'b');
      for (const x of [-11,9,32]) {
        g.frame(x,2,19,35,'k','s'); g.frame(x+2,4,15,31,'b','d');
        g.box(x+5,6,9,1,'s'); g.box(x+5,8,9,1,'s');
      }
      g.stroke([[20,9],[20,11],[13,15],[27,15],[20,11]],'w');
      mark(g,'jersey',10,13,{scale:2});
      g.box(17,23,8,9,'c'); g.text('30',17,25,'b');
      shoeBench(g,'d','w'); mark(g,'smallBall',27,31);
      break;
    case 'perfect':
      g.box(0,0,40,48,'d'); g.box(0,5,40,2,'b');
      g.box(8,1,2,13,'s'); g.box(30,1,2,13,'s');
      arcadeFloor(g,33); score(g,3,12,true);
      break;
    case 'survival':
      g.box(0,0,40,48,'d'); g.box(0,9,40,4,'b'); g.box(1,8,8,1,'s'); g.box(29,8,8,1,'s');
      arcadeFloor(g,21); hoop(g,24,5);
      mark(g,'guard',25,21,{colors:{r:'c',c:'r'}});
      g.box(3,41,17,2,'u'); mark(g,'dribble',3,17,{scale:2}); mark(g,'ball',23,33);
      break;
    case 'story':
      g.box(0,0,40,48,'w'); g.stamp(['.oo.','oooo','oooo','.oo.'],3,6,{scale:2});
      blocks(g,25,'w','u'); fence(g,24,32,'d'); g.box(0,32,40,16,'b');
      g.line(0,47,39,33,'s'); hoop(g,25,16); mark(g,'shoot',4,29);
      mark(g,'smallBall',19,13); g.box(8,44,8,1,'d');
      break;
    case 'yourCareer':
      g.box(0,0,40,48,'b'); g.box(0,11,40,2,'d');
      g.box(3,3,6,3,'s'); g.box(28,5,7,2,'s'); shoeBench(g,'d','w');
      mark(g,'highTop',7,16,{scale:2}); mark(g,'highTop',23,25,{colors:{b:'r',s:'w'}});
      g.stroke([[15,24],[19,21],[22,22],[20,25],[17,25]],'k');
      break;
    case 'weekly':
      g.box(29,0,11,48,'d'); g.box(32,0,2,48,'b');
      g.box(27,3,1,19,'s'); g.box(38,3,1,19,'s');
      pennant(g,19,12,19,25,'b','c'); mark(g,'star',22,17,{scale:2});
      break;
  }
}

function blacktop(g, name) {
  switch (name) {
    case 'franchise':
      g.box(0,0,40,48,'b'); fence(g,-5,12,'d');
      g.box(0,14,40,34,'k'); g.box(0,35,40,13,'d');
      g.line(1,46,39,29,'s');
      // A half-court drawn directly in sidewalk chalk.
      playDiagram(g,8,12,'d','t','c');
      g.box(24,38,7,2,'c'); g.box(30,38,2,1,'s'); mark(g,'ball',2,32);
      break;
    case 'legends':
      g.box(0,0,40,48,'t'); blocks(g,23,'t','b'); g.box(0,23,40,25,'d');
      g.stroke([[1,31],[37,14]],'b'); g.line(0,43,39,27,'t');
      // A title belt with a basketball centre plate.
      g.stroke([[0,24],[12,23],[21,22],[29,20],[39,17]],'k');
      g.box(0,25,40,8,'k'); g.box(0,26,40,4,'r');
      for(const x of [3,7,32,36]) g.box(x,27,2,1,'o');
      g.stamp(['..kkkkk..','.kccccck.','kcwwwwwck','kcwoodwck','kcwooodck','kcwoodwck','.kccccck.','..kkkkk..'],11,17,{scale:2});
      mark(g,'ball',17,21,{colors:{w:'o',o:'c',l:'c'}}); break;
    case 'career':
      g.box(0,0,40,48,'r'); g.box(0,27,40,21,'k');
      g.stroke([[0,27],[32,11],[39,11]],'u'); g.line(0,30,39,11,'c');
      g.box(24,4,3,1,'u'); g.box(31,8,5,1,'u');
      // A walk-up portrait at a playground gate.
      mark(g,'bust',6,10,{scale:2,flip:true,colors:{b:'t',c:'c',u:'d',h:'o',l:'c'}});
      g.box(2,31,36,12,'t'); g.box(2,31,8,12,'b'); g.box(28,31,10,12,'b');
      g.stroke([[12,30],[16,35],[21,35],[26,30]],'c'); g.text('1',18,37,'k');
      break;
    case 'perfect':
      g.box(0,0,40,48,'r');
      for (const [x,y] of [[1,4],[18,4],[7,9],[29,9],[0,36],[21,39]]) g.box(x,y,9,1,'u');
      g.box(0,36,40,12,'d'); g.line(0,47,33,40,'t');
      g.box(8,8,2,7,'k'); g.box(29,6,2,9,'k'); score(g,3,14,false);
      break;
    case 'survival':
      g.box(0,0,40,48,'d'); g.box(0,0,40,11,'r'); fence(g,7,17,'k');
      g.line(0,46,39,24,'t'); g.line(0,44,39,22,'b');
      mark(g,'guard',17,14,{scale:2,colors:{r:'t',c:'c'}});
      mark(g,'dribble',-3,22,{scale:2,colors:{b:'r',c:'c'}});
      mark(g,'ball',11,35); break;
    case 'story':
      g.box(0,0,40,48,'o'); blocks(g,18,'o','u');
      g.box(0,18,40,30,'b'); g.box(0,31,40,17,'d'); fence(g,20,31,'k');
      g.box(26,20,2,23,'k'); hoop(g,20,12,{c:'t',s:'b',o:'r'}); g.line(0,47,38,34,'t');
      g.box(3,35,8,2,'w'); g.box(4,37,1,4,'k'); g.box(9,37,1,4,'k');
      mark(g,'ball',11,34); break;
    case 'yourCareer':
      g.box(0,0,40,48,'b'); g.box(0,26,40,22,'d'); fence(g,-7,10,'d');
      g.box(5,28,30,9,'u'); g.box(0,38,40,3,'k'); g.box(0,38,40,1,'t');
      mark(g,'envelope',5,16,{scale:2,colors:{b:'t'}});
      mark(g,'cap',20,27,{colors:{b:'r',s:'w',t:'c'}});
      break;
    case 'weekly':
      g.box(30,0,10,48,'u'); g.box(34,0,6,48,'r');
      g.frame(20,11,18,26,'k','c'); g.box(22,13,14,3,'r');
      hoop(g,23,19,{c:'t',s:'b',o:'r'}); g.box(21,11,1,1,'t');
      g.box(35,36,2,1,'w'); break;
  }
}

function pocket(g, name) {
  switch (name) {
    case 'franchise':
      g.box(0,0,40,48,'t'); g.box(0,34,40,14,'b');
      notebook(g,5,5,27,36); playDiagram(g,10,12,'c','b','k');
      g.line(31,36,37,12,'k'); g.line(32,36,38,12,'c'); break;
    case 'legends':
      g.box(0,0,40,48,'c'); g.box(0,34,40,14,'t');
      g.frame(7,5,24,33,'k','b'); g.frame(9,7,20,25,'k','t');
      mark(g,'cup',13,11,{colors:{w:'b',u:'k',o:'c',c:'c',l:'c'}});
      g.box(12,34,13,1,'c'); g.box(11,40,18,3,'k'); break;
    case 'career':
      g.box(0,0,40,48,'b'); g.frame(5,3,29,39,'k','c');
      g.frame(8,7,23,24,'k','t'); mark(g,'bust',7,10,{scale:2});
      g.box(9,33,8,2,'k'); g.box(9,37,18,1,'b'); g.box(24,33,5,1,'b');
      break;
    case 'perfect':
      g.box(0,0,40,48,'c'); g.box(0,33,40,15,'t');
      g.box(8,29,2,10,'k'); g.box(30,29,2,10,'k');
      score(g,3,11,false); g.line(1,42,38,42,'b'); mark(g,'smallBall',17,35);
      break;
    case 'survival':
      g.box(0,0,40,48,'t'); g.frame(3,4,34,40,'k','c');
      g.box(4,9,32,1,'b'); g.box(4,36,32,1,'b');
      for (const [x,y] of [[7,26],[23,16],[12,12]]) crossed(g,x,y,'b');
      g.stroke([[12,32],[18,25],[18,21],[24,17]],'k');
      g.stroke([[20,17],[24,17],[24,21]],'k'); mark(g,'smallBall',10,29);
      g.box(8,39,5,1,'b'); g.box(15,39,3,1,'t'); break;
    case 'story':
      g.box(0,0,40,48,'b'); notebook(g,3,7,31,34,false);
      g.frame(6,10,24,12,'b','t'); blocksInset(g);
      g.frame(6,24,12,12,'b','c'); g.stamp(['..kk.','.kcck','.kkk.','..k..','.kkk.'],9,27);
      g.frame(20,24,10,12,'b','t'); mark(g,'smallBall',23,27); g.box(7,38,19,1,'b'); break;
    case 'yourCareer':
      g.box(0,0,40,48,'c'); g.box(0,28,40,20,'t'); notebook(g,12,5,22,29);
      g.box(18,9,11,2,'b'); g.box(18,14,10,1,'t'); g.box(18,17,7,1,'b');
      mark(g,'highTop',4,21,{scale:2}); g.line(25,38,35,31,'b'); break;
    case 'weekly':
      g.box(34,0,6,48,'b'); g.frame(20,12,18,23,'k','c');
      g.box(21,13,16,4,'t'); g.box(24,10,2,5,'k'); g.box(32,10,2,5,'k');
      g.box(22,19,14,1,'b'); mark(g,'star',25,23,{colors:{o:'b',w:'b'}});
      break;
  }
}

function blocksInset(g) {
  g.box(7,16,4,5,'b'); g.box(11,13,5,8,'b'); g.box(18,15,8,6,'b');
  g.box(13,15,1,2,'c'); g.box(20,17,1,1,'t'); g.box(26,11,2,2,'c');
}

export const playNames = ['franchise','legends','career','perfect','survival','story','yourCareer','weekly'];

export function poster(style, name) {
  const g = new PixelGrid(40,48);
  ({ fieldhouse, blacktop, pocket })[style](g,name);
  return g;
}
