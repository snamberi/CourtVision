import { PixelGrid } from './pixels.mjs';
import { arcadeFloor, crossed, fence, hoop, mark, notebook, pennant, ring } from './stamps.mjs';

export const miniNames = ['grid','guess','categorize','guessTeam','dailyDraft','hilo','bracket','quiz','legendsT','street','oneOnOne','tour'];

function tradingCard(g,x,y,accent,markId) {
  g.box(x+1,y+1,8,10,'k'); g.frame(x,y,8,10,'k','c');
  g.box(x+1,y+1,6,6,accent);
  if(markId===0) ring(g,x+2,y+2,'c');
  if(markId===1) crossed(g,x+2,y+2,'c');
  if(markId===2) g.box(x+3,y+2,2,3,'k');
  if(markId===3) g.stroke([[x+2,y+5],[x+4,y+2],[x+6,y+5]],'c');
  g.box(x+2,y+8,4,1,'b');
}

function arrow(g,x,y,up,ink) {
  const rows=['..1..','.111.','11111','..1..','..1..','..1..'];
  g.stamp(up?rows:[...rows].reverse(),x,y,{colors:{1:ink}});
}

function bracket(g,x,y,ink,winner) {
  for(const left of [true,false]) {
    const a = left ? x : x+20, b = left ? x+4 : x+16, c = left ? x+8 : x+12;
    for(const row of [0,4,10,14]) g.line(a,y+row,b,y+row,ink);
    g.line(b,y,b,y+4,ink); g.line(b,y+10,b,y+14,ink);
    g.line(b,y+2,c,y+2,ink); g.line(b,y+12,c,y+12,ink);
    g.line(c,y+2,c,y+12,ink); g.line(c,y+7,x+10,y+7,ink);
  }
  g.stroke([[x,y],[x+4,y],[x+4,y+2],[x+8,y+2],[x+8,y+7],[x+10,y+7]],winner);
  g.box(x+9,y+6,3,3,winner);
}

function team(g,x,y,shirt) {
  g.stamp(['.k.','khk','.h.', '111','.1.','k.k'],x,y,{colors:{1:shirt}});
}

function surface(g,style,kind) {
  if(style==='pocket') {
    g.box(0,0,32,32,kind==='arena'?'t':'c');
    if(kind==='arena') { g.box(0,21,32,11,'c'); g.box(0,21,32,1,'b'); }
    return;
  }
  const street=style==='blacktop';
  if(kind==='arena') {
    g.box(0,0,32,32,street?'r':'d');
    if(street) { fence(g,6,13,'u'); g.box(0,13,32,5,'b'); }
    else { g.box(0,7,32,1,'b'); g.box(3,5,7,1,'s'); g.box(24,5,7,1,'s'); }
    arcadeFloor(g,17,street?'d':'w',street?'t':'c');
  } else if(kind==='table') {
    g.box(0,0,32,32,street?'b':'w'); g.box(0,24,32,8,street?'d':'u');
    g.line(0,26,31,26,street?'s':'w');
  } else {
    g.box(0,0,32,32,street?'r':'d');
    if(street) {
      g.box(1,4,6,1,'u'); g.box(16,2,8,1,'u'); g.box(22,26,8,1,'u');
    } else {
      g.box(0,5,32,2,'b'); g.box(0,25,32,7,'b');
    }
  }
}

export function minigame(style, name) {
  const g = new PixelGrid(32,32);
  const street = style==='blacktop', handheld = style==='pocket';
  const action = ['legendsT','street','oneOnOne','quiz'];
  const panels = ['guess','guessTeam','bracket','hilo'];
  surface(g,style,action.includes(name)?'arena':panels.includes(name)?'wall':'table');
  switch(name) {
    case 'grid': {
      const x=street?3:handheld?7:4, y=street?7:handheld?3:5;
      if(handheld) notebook(g,2,1,27,28);
      if(!handheld && !street) g.frame(2,2,27,27,'k','u');
      g.frame(x,y,22,22,street?'t':'k',street?'d':handheld?'c':'b');
      const ink=street?'t':handheld?'b':'c';
      for(const n of [7,14]) { g.box(x+n,y+1,1,20,ink); g.box(x+1,y+n,20,1,ink); }
      ring(g,x+2,y+2,ink); crossed(g,x+9,y+9,street?'o':handheld?'k':'o');
      crossed(g,x+16,y+2,ink); ring(g,x+2,y+16,ink);
      if(street) mark(g,'smallBall',24,23);
      else if(!handheld) g.box(16,27,7,1,'c');
      break;
    }
    case 'guess':
      if(handheld) {
        g.frame(4,3,21,27,'k','c'); g.frame(6,5,17,17,'k','t');
        mark(g,'bust',7,11,{colors:{u:'k',h:'b',c:'t',b:'k'}});
        g.text('?',23,13,'k',2); g.box(7,25,11,1,'b');
      } else if(street) {
        g.frame(4,4,23,24,'k','c'); g.box(6,6,19,20,'b');
        mark(g,'bust',5,8,{scale:2,colors:{h:'d',u:'k',c:'t',b:'d',l:'t'}});
        g.text('?',22,7,'c'); g.box(3,3,5,2,'o'); g.box(25,26,4,1,'o');
      } else {
        g.box(4,3,23,27,'k'); g.box(7,5,18,21,'b');
        mark(g,'bust',3,10,{scale:2,colors:{h:'d',u:'k',c:'s',b:'k',l:'s'}});
        g.text('?',21,5,'c'); g.box(5,28,17,1,'s');
      }
      break;
    case 'categorize': {
      if(handheld) { notebook(g,3,2,26,26); g.box(16,4,1,22,'t'); g.box(6,16,21,1,'t'); }
      const places=street?[[2,5],[14,3],[7,16],[21,15]]:handheld?[[6,4],[19,4],[7,18],[19,17]]:[[3,4],[17,3],[6,17],[20,16]];
      for(const [i,[x,y]] of places.entries()) tradingCard(g,x,y,['b','r','t','u'][i],i);
      break;
    }
    case 'guessTeam':
      if(handheld) {
        notebook(g,3,3,26,25); g.frame(7,6,19,18,'b','c');
        for(const [x,y] of [[9,7],[19,7],[14,12],[9,18],[19,18]]) team(g,x,y,'k');
      } else {
        g.box(2,8,28,1,street?'c':'s');
        const positions=street?[[2,5],[13,6],[24,5],[8,18],[18,19]]:[[2,8],[13,8],[24,8],[7,18],[18,18]];
        for(const [i,[x,y]] of positions.entries()) {
          g.box(x+2,y-2,1,2,street?'c':'s');
          mark(g,'shirt',x,y,{scale: i===3?2:1,colors:{c:street?['t','c','o','r','t'][i]:['c','r','c','o','b'][i]}});
        }
      }
      break;
    case 'dailyDraft':
      if(handheld) {
        notebook(g,3,3,23,25); g.text('1',9,7,'k',2);
        g.box(8,21,8,1,'b'); mark(g,'cap',17,18,{colors:{b:'b',t:'t',s:'c'}});
      } else if(street) {
        mark(g,'envelope',2,8,{scale:2}); mark(g,'cap',13,18,{colors:{b:'r',t:'c'}});
      } else {
        g.box(0,0,32,20,'d'); g.frame(3,19,26,12,'k','b');
        mark(g,'cap',4,7,{scale:2,colors:{b:'r',s:'w',t:'c'}});
        g.line(23,19,26,11,'s'); g.box(25,10,4,3,'k'); g.box(9,24,10,1,'s');
      }
      break;
    case 'hilo':
      if(handheld) {
        g.frame(3,5,26,22,'k','c'); g.box(16,6,1,20,'b');
        arrow(g,7,9,true,'k'); arrow(g,20,15,false,'b');
        g.box(6,21,7,2,'b'); g.box(20,9,6,2,'t');
      } else {
        const dx=street?3:1;
        tradingCard(g,3+dx,street?12:9,'b',0); tradingCard(g,16+dx,street?5:13,'r',2);
        arrow(g,street?5:6,street?4:2,true,street?'c':'o'); arrow(g,21,23,false,street?'t':'s');
        g.line(2,28,28,3,street?'t':'b');
      }
      break;
    case 'bracket':
      if(handheld) notebook(g,1,3,29,25);
      else if(!street) { g.box(7,27,2,4,'u'); g.box(23,27,2,4,'u'); g.frame(1,4,30,23,'k','b'); }
      else { g.box(1,5,30,22,'d'); g.box(3,25,6,1,'c'); }
      bracket(g,handheld?6:5,street?9:8,handheld?'b':street?'t':'c',handheld?'k':'o');
      break;
    case 'quiz': {
      const x=street?2:handheld?9:5, y=street?12:handheld?15:12;
      g.stamp(['....kkkk....','...kclllk...','..kloooowk..','..kooooowk..','.kkwwwwwukk.','kbbbbbbbbbbk','kcccccccccck','kkkkkkkkkkkk'],x,y,{scale:street||!handheld?2:1,colors:street?{o:'t',w:'b',u:'d',b:'r'}:{}});
      if(handheld) { g.frame(6,2,18,10,'b','c'); g.text('?',13,4,'k'); g.box(8,23,14,2,'k'); }
      else { g.box(x+8,5,1,4,'c'); g.line(x+15,8,x+18,5,'c'); }
      break;
    }
    case 'legendsT':
      if(handheld) {
        g.frame(4,3,23,26,'k','c'); g.frame(6,5,19,18,'b','t');
        mark(g,'bust',8,11); pennant(g,19,1,8,9,'b','c'); g.box(8,26,14,1,'k');
      } else if(street) {
        g.frame(3,17,27,11,'k','r'); g.box(5,20,22,1,'u');
        mark(g,'ball',9,7,{scale:2,colors:{o:'c',w:'o',u:'r'}});
        g.stamp(['1.1.1','11111','.111.'],11,4,{scale:2,colors:{1:'o'}});
      } else {
        pennant(g,3,1,8,12,'r','o'); pennant(g,21,-2,9,12,'b','c');
        mark(g,'cup',6,8,{scale:2});
      }
      break;
    case 'street': {
      if(handheld) {
        g.frame(3,2,26,28,'k','c'); g.frame(10,3,12,5,'b','c');
        g.stroke([[6,4],[6,9],[10,13],[21,13],[25,9],[25,4]],'b');
      } else {
        hoop(g,street?2:10,1,street?{c:'t',o:'r'}:{});
        if(street) fence(g,7,11,'k');
      }
      const points=street?[[2,17],[11,23],[22,17],[7,12],[15,14],[25,23]]:[[5,16],[14,23],[23,18],[9,10],[18,13],[24,8]];
      for(const [i,[x,y]] of points.entries()) team(g,x,y,i<3?(handheld?'k':'r'):(handheld?'t':'c'));
      g.box(12,24,2,2,handheld?'k':'o'); break;
    }
    case 'oneOnOne':
      if(handheld) {
        mark(g,'shirt',3,4,{scale:2}); mark(g,'shirt',18,17,{scale:2,colors:{c:'b'}});
        g.text('VS',11,12,'k'); g.line(2,28,9,21,'b'); g.line(21,8,28,1,'b');
      } else {
        mark(g,'dribble',street?2:3,street?12:11,{colors:{b:street?'t':'b',c:'c'}});
        mark(g,'guard',street?18:20,street?9:12,{flip:true,colors:{r:'r',c:street?'t':'c'}});
        mark(g,'smallBall',street?11:13,22);
      }
      break;
    case 'tour':
      if(handheld) {
        notebook(g,2,3,27,25); bracket(g,6,9,'b','k');
        pennant(g,16,1,8,10,'b','c');
      } else {
        g.box(0,0,32,32,street?'b':'d');
        pennant(g,street?3:5,0,7,9,street?'r':'b','c');
        pennant(g,street?22:20,-2,8,10,street?'c':'r','o');
        mark(g,'bust',0,11,{colors:{b:street?'r':'s'}}); mark(g,'bust',20,11,{flip:true,colors:{b:street?'t':'r'}});
        g.box(0,24,32,8,'u'); g.box(0,23,32,2,street?'t':'w'); mark(g,'cup',11,12);
      }
      break;
  }
  return g;
}
