/** Actual game renderer, not concept art. Generates a 16-exposure contact sheet,
 * frame SVGs and a pause/scrub HTML preview at 16 FPS.
 * npx rolldown scripts/preview-athlete-motion.ts --platform node --file /tmp/athletes.mjs
 * node /tmp/athletes.mjs /tmp/mini-athlete
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANIMATIONS, rasterizePose, type CourtView, type Pose } from '../src/visuals/actionSprites';
import { RUN_DRIBBLE16 } from '../src/visuals/athleteFrames';
import { buildPlayerSprite, type SpritePath } from '../src/visuals/playerSprite';

const out=resolve(process.argv[2]??'/tmp/mini-athlete');mkdirSync(out,{recursive:true});
const paths=(ps:SpritePath[])=>ps.map(p=>`<path fill="${p.fill}" d="${p.d}"/>`).join('');
const text=(x:number,y:number,s:string,size=14)=>`<text x="${x}" y="${y}" fill="#dce5f4" font-family="sans-serif" font-size="${size}">${s}</text>`;
const look={playerId:'Stephen Curry',primary:'#1d428a',secondary:'#ffc72c',jerseyNumber:30};
const rows:{name:string;frames:readonly Pose[];view:CourtView}[]=[
  {name:'Run / side',frames:ANIMATIONS.run,view:'right'},
  {name:'Run / toward camera',frames:ANIMATIONS.run,view:'frontRight'},
  {name:'Sprint',frames:ANIMATIONS.sprint,view:'right'},
  {name:'Running dribble',frames:RUN_DRIBBLE16,view:'frontRight'},
  {name:'Jump shot',frames:ANIMATIONS.jumper,view:'frontRight'},
  {name:'Dunk',frames:ANIMATIONS.dunk,view:'frontRight'},
];
const sprite=(p:Pose,view:CourtView,x:number,y:number,scale:number)=>`<g transform="translate(${x},${y}) scale(${scale})" shape-rendering="crispEdges">${paths(rasterizePose(p,{...look,view}))}</g>`;
const wrap=(w:number,h:number,body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#121b2b"/>${body}</svg>`;
const frames:string[]=[];
for(let i=0;i<16;i++){
  let body=text(30,35,'DESIGN 6 · ACTUAL GAME SPRITES',23)+text(30,59,'16 FPS · authored poses · no torso tilting',14);
  rows.forEach((row,col)=>{
    const x=col*160+5;
    body+=`<path d="M${x+10} 277h140" stroke="#40516a"/>`+sprite(row.frames[i],row.view,x+10,79,2.8)+text(x+12,311,row.name,12);
  });
  body+=text(30,349,`Drawing ${String(i+1).padStart(2,'0')} / 16 · Foot positions and shoe angles are drawn per frame.`,14);
  const svg=wrap(980,370,body);frames.push(svg);writeFileSync(`${out}/frame-${String(i).padStart(2,'0')}.svg`,svg);
}
let sheet=text(24,28,'Actual renderings · all 16 drawings in order',20);
rows.forEach((row,r)=>{
  sheet+=text(18,62+r*150,row.name);
  row.frames.forEach((p,i)=>{sheet+=sprite(p,row.view,i*76,64+r*150,1.25)+text(29+i*76,163+r*150,String(i+1),10);});
});
writeFileSync(`${out}/contact-sheet.svg`,wrap(1220,965,sheet));
writeFileSync(`${out}/portrait.svg`,wrap(320,416,`<g transform="scale(8)" shape-rendering="crispEdges">${paths(buildPlayerSprite(look))}</g>`));
// JSON encoding keeps artwork data out of executable markup.
writeFileSync(`${out}/index.html`,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mini Athlete · actual renderer</title><style>body{background:#121b2b;color:#dce5f4;font:16px system-ui;margin:24px}main{max-width:1100px;margin:auto}svg{width:100%;height:auto}button,input{margin:8px;padding:8px}footer{color:#a3b4cf}</style><main><div id="art"></div><button id="pause">Pause</button><label>Frame <input id="frame" type="range" min="0" max="15" value="0"></label><footer>Actual renderer. This sheet plays each drawing for 62.5 ms; watched-game actions use release/contact timing and distance-based strides.</footer></main><script>const frames=${JSON.stringify(frames)};let index=0,playing=true,last=performance.now();const art=document.querySelector('#art'),slider=document.querySelector('#frame'),pause=document.querySelector('#pause');function draw(){art.innerHTML=frames[index];slider.value=index}pause.onclick=()=>{playing=!playing;pause.textContent=playing?'Pause':'Play';last=performance.now()};slider.oninput=()=>{playing=false;pause.textContent='Play';index=+slider.value;draw()};function tick(now){if(playing&&now-last>=62.5){const steps=Math.floor((now-last)/62.5);index=(index+steps)%16;last+=steps*62.5;draw()}requestAnimationFrame(tick)}draw();requestAnimationFrame(tick);</script>`);
