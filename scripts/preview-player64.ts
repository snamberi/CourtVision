/** Exports the actual integer color grids, for the companion PNG/GIF renderer.
 * npx rolldown scripts/preview-player64.ts --platform node --file /tmp/player64.mjs
 * node /tmp/player64.mjs /tmp/player64.json
 * python3 scripts/preview-player64.py /tmp/player64.json docs/previews
 */
import { writeFileSync } from 'node:fs';
import { buildPlayerGrid, outlineGrid } from '../src/visuals/playerSprite';
import { rasterizePoseGrid, POSES, ANIMATIONS, pickFrame, type CourtView } from '../src/visuals/actionSprites';
import { buildAvatarGrid } from '../src/visuals/avatarSprite';
import { DEFAULT_AVATAR, OUTFITS } from '../src/profile/avatar';
const ids=['Stephen Curry','LeBron James','Giannis Antetokounmpo','Nikola Jokic','Allen Iverson','Damon Cross'];
const kits=[['#1d428a','#ffc72c'],['#fdb927','#552583'],['#00471b','#eee1c6'],['#0e2240','#fec524'],['#cc1539','#f4f4f4'],['#202838','#eaa367']];
const look=(i:number)=>({playerId:ids[i],primary:kits[i][0],secondary:kits[i][1],jerseyNumber:[30,23,34,15,3,1][i]});
const views:CourtView[]=['front','frontRight','right','backRight','back','backLeft','left','frontLeft'];
const animations=Array.from({length:8},(_,i)=>{
 const t=i/8,run=pickFrame({pose:'run',moving:true,carrier:false,ballZ:20,cycle:t,gait:'run'}),dribble=pickFrame({pose:'dribble',moving:true,carrier:true,ballZ:[24,18,10,4,10,18,24,27][i],cycle:t});
 return {run:rasterizePoseGrid(run.pose,{...look(0),view:'right'}),dribble:rasterizePoseGrid(dribble.pose,{...look(0),view:'frontRight'}),
  shoot:rasterizePoseGrid(ANIMATIONS.jumper[Math.min(5,Math.floor(i*6/8))],look(0)),dunk:rasterizePoseGrid(ANIMATIONS.dunk[Math.min(5,Math.floor(i*6/8))],{...look(1),view:'frontRight'}),
  defense:rasterizePoseGrid(ANIMATIONS.slide[Math.min(5,Math.floor(i*6/8))],look(2))};
});
writeFileSync(process.argv[2]??'/tmp/player64.json',JSON.stringify({
 players:ids.map((name,i)=>({name,grid:outlineGrid(buildPlayerGrid(look(i)))})),
 views:views.map(view=>({name:view,grid:rasterizePoseGrid(POSES.STAND,{...look(0),view})})),animations,
 cosmetics:['jersey','hoodie','royal','wizard','santa','sovereign'].map(kind=>({name:kind,grid:buildAvatarGrid({look:{...DEFAULT_AVATAR,outfit:OUTFITS.find(o=>o.kind===kind)!.id}}).grid})),
}));
