import { describe, expect, it } from 'vitest';
import { athleticGrid, buildPlayerGrid, buildPlayerSprite, HAIR_STYLES, BEARD_STYLES, HAT_STYLES, SKIN_TONES } from '../visuals/playerSprite';
import { buildAvatarGrid, buildAvatarSprite, AVATAR_H, AVATAR_W } from '../visuals/avatarSprite';
import { DEFAULT_AVATAR } from '../profile/avatar';
import { ANIMATIONS, rasterizePose, type CourtView } from '../visuals/actionSprites';

const kit = { playerId: 'Created character', primary: '#2345ab', secondary: '#e8bd62', jerseyNumber: 28 };
describe('athletic character design', () => {
  it('adds a finer silhouette with a smaller head while retaining the display canvas and foot anchor', () => {
    const raw=buildPlayerGrid({...kit,appearance:{hatStyle:'none',hairStyle:'short'}}), fine=athleticGrid(raw);
    expect(fine).toHaveLength(104); expect(fine[0]).toHaveLength(80);
    const headWidth=(grid:(string|null)[][],scale:number)=>Math.max(...grid.slice(4*scale,20*scale).map(row=>row.filter(Boolean).length))/scale;
    expect(headWidth(fine,2)).toBeLessThan(headWidth(raw,1));
    const bottom=(grid:(string|null)[][])=>grid.findLastIndex(row=>row.some(Boolean));
    expect((bottom(fine)+1)/2).toBe(bottom(raw)+1);
    expect(buildPlayerSprite(kit).some(p=>p.d.includes('.5'))).toBe(true);
  });

  it('retains every player appearance family and custom colors without rewriting saved choices', () => {
    const looks=[...HAIR_STYLES.map(hairStyle=>({hairStyle})),...BEARD_STYLES.map(beardStyle=>({beardStyle})),...HAT_STYLES.map(hatStyle=>({hatStyle}))];
    for (const appearance of looks) {
      const options={...kit,appearance:{...appearance,skinHex:'#63bfa1',hairHex:'#a34578'}};
      const before=JSON.stringify(options), paths=buildPlayerSprite(options);
      expect(paths.some(p=>p.fill==='#63bfa1')).toBe(true);
      expect(paths.map(p=>p.d).join('')).not.toMatch(/NaN|Infinity|undefined/);
      expect(JSON.stringify(options)).toBe(before);
    }
  });

  it('uses the same appearance and shooting sleeve in all eight court directions', () => {
    const views:CourtView[]=['front','frontLeft','frontRight','left','right','backLeft','backRight','back'];
    for(const view of views)for(let skin=0;skin<SKIN_TONES.length;skin++) {
      const options={...kit,view,appearance:{skin,hatStyle:'none' as const,goggles:true,sleeve:true}};
      const paths=rasterizePose(ANIMATIONS.run[0],options);
      expect(paths.some(p=>p.fill===SKIN_TONES[skin])).toBe(true);
      expect(paths).not.toEqual(rasterizePose(ANIMATIONS.run[0],{...options,appearance:{...options.appearance,sleeve:false}}));
    }
  });

  it('fits user cosmetics and auras to the finer body without tint placeholders or aura overpaint', () => {
    for(const pattern of ['rainbow','glitch','frozen','inferno']) {
      const look={...DEFAULT_AVATAR,skin:pattern,hairColor:pattern,outfit:'sovereignGold',hat:'crown',aura:'fire'};
      const before=JSON.stringify(look), {grid,aura}=buildAvatarGrid({look});
      expect(grid).toHaveLength(AVATAR_H*2);expect(grid[0]).toHaveLength(AVATAR_W*2);
      expect(aura.flat().some(Boolean)).toBe(true);
      for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(grid[y][x])expect(aura[y][x]).toBeNull();
      const sprite=buildAvatarSprite({look});
      expect(sprite.paths.some(p=>/fe01fe|01fefe/i.test(p.fill))).toBe(false);
      expect(JSON.stringify(look)).toBe(before);
    }
  });
});
