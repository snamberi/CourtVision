/** Render the actual shared character art for visual review; no browser or saved account required.
 * npx rolldown scripts/preview-characters.ts --platform node --file /tmp/characters.mjs
 * node /tmp/characters.mjs /tmp/characters.svg
 */
import { writeFileSync } from 'node:fs';
import { buildPlayerSprite, type SpritePath } from '../src/visuals/playerSprite';
import { buildAvatarSprite, buildFigureSprite } from '../src/visuals/avatarSprite';
import { DEFAULT_AVATAR, OUTFITS } from '../src/profile/avatar';
import { actionSprite, ANIMATIONS, type CourtView } from '../src/visuals/actionSprites';

const paths = (ps: SpritePath[]) => ps.map(p => `<path fill="${p.fill}" d="${p.d}"/>`).join('');
const label = (x: number, y: number, text: string) => `<text x="${x}" y="${y}" text-anchor="middle" fill="#e9edf5" font-size="13" font-family="sans-serif">${text}</text>`;
const cells: string[] = [];
const players = ['Stephen Curry', 'LeBron James', 'Kevin Durant', 'Kareem Abdul-Jabbar', 'Allen Iverson', 'Damon Cross'];
players.forEach((playerId, i) => {
  const p = buildPlayerSprite({ playerId, primary: '#1d428a', secondary: '#ffc72c', jerseyNumber: [30,23,35,33,3,12][i] });
  cells.push(`<g transform="translate(${35+i*160},50) scale(2.7)" shape-rendering="crispEdges">${paths(p)}</g>${label(89+i*160,215,playerId)}`);
  cells.push(`<g transform="translate(${69+i*160},230)" shape-rendering="crispEdges">${paths(p)}</g>`);
});
const outfitKinds = ['jersey', 'hoodie', 'royal', 'wizard', 'santa', 'sovereign'];
outfitKinds.forEach((kind,i) => {
  const outfit = OUTFITS.find(o=>o.kind===kind)!.id;
  const s = buildAvatarSprite({ look: {...DEFAULT_AVATAR,outfit, hair: i%2?'dreadsLong':'afroLarge',skin:i===4?'rainbow':DEFAULT_AVATAR.skin,hat:i===2?'crown':'none',aura:i===5?'fire':'none'},team:{primary:'#552583',secondary:'#fdb927'} });
  cells.push(`<g transform="translate(${30+i*160},330) scale(2.5)" shape-rendering="crispEdges">${paths(s.aura)}${paths(s.paths)}</g>${label(89+i*160,500,kind)}`);
});
const views: CourtView[] = ['front','frontRight','right','backRight','back','backLeft','left','frontLeft'];
views.forEach((view,i) => {
  const p = actionSprite(`review-${i}`,ANIMATIONS.run[i%6],{playerId:'Stephen Curry',primary:'#1d428a',secondary:'#ffc72c',jerseyNumber:30,view});
  cells.push(`<g transform="translate(${5+i*125},540) scale(1.8)" shape-rendering="crispEdges">${paths(p)}</g>${label(60+i*125,690,view)}`);
});
(['jumper','dunk','slide','layup','celebrate','dive'] as const).forEach((kind,i) => {
  const frames=ANIMATIONS[kind];
  const p=actionSprite(`review-action-${kind}`,frames[2],{playerId:i%2?'Allen Iverson':'Kevin Durant',primary:'#792b38',secondary:'#ffc72c',jerseyNumber:i%2?3:35,view:'frontRight'});
  cells.push(`<g transform="translate(${25+i*160},735) scale(2)" shape-rendering="crispEdges">${paths(p)}</g>${label(85+i*160,900,kind)}`);
});
['down','point','up'].forEach((pose,i)=>{
  const p=buildFigureSprite({id:'review-coach',skin:'#c68a5a',hair:'#2b1a10',kind:'suit',main:'#29436d',trim:'#e5e9ef',pose:pose as 'down'|'point'|'up'});
  cells.push(`<g transform="translate(${115+i*300},960) scale(2)" shape-rendering="crispEdges">${paths(p)}</g>${label(155+i*300,1080,`Coach · ${pose}`)}`);
});
writeFileSync(process.argv[2]??'/tmp/characters.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="1100" viewBox="0 0 1020 1100"><rect width="1020" height="1100" fill="#151c29"/>${label(510,25,'Actual renderer · athletic proportions + soft shading')}${label(510,315,'Custom characters · saved cosmetic layers')}${label(510,530,'Court directions')}${label(510,725,'Court actions')}${label(510,945,'Sideline figures')}${cells.join('')}</svg>`);
