import { PixelGrid } from './pixels.mjs';
import { mark, notebook, pennant, ring } from './stamps.mjs';

const gear = [
  '......kkk......','...kk.kcsk.kk..','..kcskcsskkssk.','.kcssssssssssk.','..ksssssssbsk..',
  '.kksskkkksbbkk.','kcssk....ksbbsk','ksssk....ksbbbk','ksssk....ksbbbk',
  '.kkssk..ksbbkk.','..kcsskksbbbk..','.kcssssbbbbssk.','..ksskbbbkkssk.','...kk.kbbk.kk..','......kkk......',
];
const ticket = [
  '..kkkkkkkkkkkk..','.kccccccckcoook.','kcoooooockcoookk','kcooooooocoooock',
  '.kcoooowckcoook.','..kooowwocooook.','.kcooowwckcoook.','kcoowwwwocoooock',
  'kcccccccckccccck','.kkkkkkkkkkkkkk.',
];
const parcel = [
  '.....kk.kk....','....kokokok...','....kookook...','..kkkkookkkk..',
  '.krrccllccrrk.','krrrooccrrrrwk','krrrooccrrrrwk','.krrwoccrrrk..',
  '.krrwoccrrrk..','.krrwoccrruk..','.krrwoccrruk..','.kwwwoccuuuk..','..kkkkkkkkk...',
];
const book = [
  '.kkkkkk..kkkkkk.','kcllllckkcccccwk','kcccccckkcccccwk','kccbbbckkcbbbcck',
  'kcccccckkcccccck','kccbbbckkcbbbcck','kcccccckkcccccck','kccbbcckkccbbcck',
  'kcccccckkcccccck','kwwcccckkcccccwk','kuwwwwwkkwwwwwuk','.kkkkkkkkkkkkkk.',
];
const wrench = [
  '..........kk..k.','.........kcs.kkk','.........kcssskk','.........kcssbk.',
  '..........kssk..','.........kssbk..','........kssbk...', '.......kssbk....',
  '......kssbk.....','.....kssbk......','....kssbk.......','...kssbk........',
  '..kssbk.........','.kcskk..........','.kbbk...........','..kk............',
];

export const equipmentNames = ['profile','podium','almanac','gifts','settings','collection','achievements','credits','chest'];

function chest(style) {
  const g = new PixelGrid(24,16);
  if(style==='blacktop') {
    g.stroke([[8,5],[9,2],[15,2],[16,5]],'k'); g.box(10,3,5,1,'c');
    g.stamp(['..kkkkkkkkkkkkkkkk..','.kttttttttttttttttk.','kttbbtttttttttbbtttk','kttbbkccccccckbbtttk',
      'kbtbbtttttttttbbttbk','kbtbbbbbttbbbbbbttbk','kbtrrrrbbbbrrrbbttbk','.kbbbbbbbbbbbbbbbbk.','..kkkkkkkkkkkkkkkk..'],2,5);
    return g;
  }
  const bright = style==='pocket'?'c':'w', middle = style==='pocket'?'t':'u';
  g.frame(1,4,22,10,'k',middle); g.frame(2,2,20,6,'k',bright);
  g.box(3,3,18,1,style==='pocket'?'t':'o'); g.box(2,7,20,2,'k');
  g.box(4,3,2,10,'b'); g.box(18,3,2,10,'b'); g.frame(10,6,4,5,'k','c');
  g.dot(12,8,'k'); g.box(3,13,3,1,'k'); g.box(18,13,3,1,'k');
  return g;
}

export function equipment(style,name) {
  const street=style==='blacktop', handheld=style==='pocket';
  if(name==='chest') return chest(style);
  const g=new PixelGrid(20,20);
  switch(name) {
    case 'profile':
      if(handheld) {
        g.frame(2,1,15,18,'k','c'); g.frame(4,3,11,11,'b','t');
        mark(g,'bust',3,5); g.box(5,16,9,1,'b');
      } else {
        mark(g,'bust',4,3,{flip:street,colors:street?{h:'o',u:'d',b:'t',c:'c'}:{}});
        g.box(1,14,18,4,street?'t':'b'); g.box(1,16,4,2,street?'b':'d'); g.box(16,16,3,2,street?'b':'d');
        g.stroke([[7,13],[9,15],[11,15],[13,13]],'c'); if(street) g.box(8,6,7,1,'r');
      }
      break;
    case 'podium':
      if(handheld) {
        g.frame(2,12,5,6,'k','t'); g.frame(7,7,6,11,'k','c'); g.frame(13,14,5,4,'k','t');
        g.box(9,1,1,7,'k'); g.box(10,1,6,2,'b'); g.box(10,3,3,1,'b');
      } else if(street) {
        for(const [x,y,w] of [[1,12,6],[7,9,7],[14,14,5]]) {
          g.frame(x,y,w,18-y,'k','r'); g.box(x+1,y+2,w-2,1,'o');
        }
        mark(g,'smallBall',9,4);
      } else {
        g.frame(1,11,6,7,'k','s'); g.frame(7,8,7,10,'k','o'); g.frame(14,13,5,5,'k','w');
        g.text('1',9,10,'k'); g.text('2',3,12,'k'); g.box(10,1,1,7,'k'); g.box(11,1,6,3,'r');
      }
      break;
    case 'almanac':
      if(handheld) { notebook(g,3,2,14,16); g.box(8,6,7,1,'k'); g.frame(8,9,6,5,'b','c'); }
      else if(street) {
        g.frame(3,3,14,15,'k','r'); g.box(4,4,2,12,'u'); g.box(7,5,8,2,'c');
        mark(g,'smallBall',9,9); g.box(5,16,10,1,'c'); g.box(13,15,2,3,'t');
      } else g.stamp(book,2,4);
      break;
    case 'gifts':
      if(handheld) { mark(g,'envelope',3,6); g.frame(8,8,5,5,'k','t'); g.dot(10,10,'c'); }
      else if(street) {
        g.frame(1,7,18,10,'k','w'); g.box(2,9,16,1,'c'); g.box(8,6,2,11,'t');
        g.stroke([[9,7],[6,4],[4,5],[5,7],[12,7],[15,5],[14,4],[10,6]],'k');
        g.box(13,11,3,3,'c');
      } else g.stamp(parcel,3,3);
      break;
    case 'settings':
      if(handheld) {
        g.frame(2,2,16,16,'k','t');
        for(const [x,y] of [[6,6],[10,11],[14,8]]) {
          g.box(x,4,1,12,'b'); g.frame(x-2,y,4,3,'k','c');
        }
      } else if(street) {
        g.stroke([[3,3],[16,16],[16,17]],'c'); g.stroke([[3,4],[15,16]],'r');
        g.stamp(wrench,2,2,{colors:{s:'t',b:'b'}});
      } else g.stamp(gear,2,2);
      break;
    case 'collection':
      if(handheld) {
        notebook(g,2,2,15,16); g.frame(6,5,8,9,'b','t'); mark(g,'shirt',8,7); g.box(7,15,6,1,'b');
      } else if(street) {
        g.frame(3,1,14,17,'k','t'); g.frame(5,4,14,15,'k','c');
        mark(g,'highTop',7,6,{colors:{b:'r',s:'w'}}); g.box(7,16,9,1,'b');
      } else {
        g.frame(1,2,11,14,'k','b'); g.frame(4,3,11,15,'k','r'); g.frame(7,4,12,15,'k','c');
        mark(g,'shirt',10,6,{colors:{c:'b'}}); g.box(10,14,6,1,'w');
      }
      break;
    case 'achievements':
      if(street) {
        pennant(g,3,1,15,17,'r','t'); mark(g,'star',7,5,{colors:{o:'c',w:'o'}});
      } else {
        g.stamp(['kk...kk','kc...ck','.kc.ck.','.kccck.','..kkk..'],3,2,{scale:2,colors:{c:handheld?'b':'r'}});
        g.stamp(['.kkkkk.','kccccck','kcooock','kcooowk','kcoowwk','.kwuuk.','..kkk..'],6,10);
        g.dot(9,13,handheld?'k':'l');
      }
      break;
    case 'credits':
      if(handheld) {
        g.frame(3,2,14,16,'k','t'); g.box(4,3,6,2,'b'); g.frame(5,6,10,8,'k','c');
        ring(g,9,8,'b'); g.box(9,16,6,1,'b');
      } else if(street) {
        g.frame(1,4,18,12,'k','t'); g.frame(3,6,14,6,'k','c');
        ring(g,4,7,'b'); ring(g,12,7,'b'); g.box(5,13,10,2,'r');
      } else g.stamp(ticket,2,5);
      break;
  }
  return g;
}

export function chrome(style,name) {
  const handheld=style==='pocket', street=style==='blacktop';
  if(name==='hoop') {
    const g = new PixelGrid(16,16); g.stamp([
      '..kkkkkkkkkkkk..','.kooooooooooook.','.ko..........ok.','.ko..oooooo..ok.',
      '.ko..o....o..ok.','.ko..o....o..ok.','.kooooooooooook.','..kkkcccccckkk..',
      '....ooccoocco...','.....ooccoo.....','.....coccoc.....','......occo......','......ckkc......',
    ],0,1,{colors:{o:handheld?'t':'o',c:street?'t':'c'}});
    return g;
  }
  const g=new PixelGrid(12,12);
  if(name==='coin') {
    g.stamp(['...kkkkk...','..kooooowk.','.koccccowk.','kocooowowuk','kocoowwwouk','kococowowuk',
      'kocooowowuk','.kowwwowuk.','.kwwwwwuuk.','..kuuuukk..','...kkkk....'],0,0,{colors:{o:handheld?'t':'o',w:street?'r':'w'}});
  } else {
    const colors=handheld?{p:'t',a:'c',v:'b'}:street?{p:'t',a:'c',v:'b'}:{p:'p',a:'a',v:'v'};
    g.stamp(['...kkkkkk...','..kappppvk..','.kaapvpppvk.','kaapppvpppvk','.kavppvppvk.','..kavpppvk..','...kapvvk...',
      '....kvvk....','.....kk.....'],0,2,{colors});
  }
  return g;
}
