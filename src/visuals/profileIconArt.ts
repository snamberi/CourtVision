import { gridToPaths, type SpriteGrid, type SpritePath } from './playerSprite';

const shade = (hex: string, amount: number) => {
  if (!/^#[a-f0-9]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1),16);
  return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(amount<0?v*(1+amount):v+(255-v)*amount).toString(16).padStart(2,'0')).join('');
};

/** Quarter-pixel engraving, bevels and material texture; the original silhouette and palette stay intact. */
export function profileIconPaths(grid: SpriteGrid, base: string): SpritePath[] {
  const scale=4, h=grid.length, w=grid[0]?.length??0;
  const out: SpriteGrid=Array.from({length:h*scale},()=>Array<string|null>(w*scale).fill(null));
  const cloth=['jersey','headband','sneaker'].includes(base);
  const leather=['ball','fireball'].includes(base);
  const metal=['trophy','crown','sovereign','ring','medal','shield','diamond','goatcrown','skybox','card'].includes(base);
  const shades=new Map<string,string>();
  const tint=(c:string,a:number)=>{const k=`${c}:${a}`;let v=shades.get(k);if(!v){v=shade(c,a);shades.set(k,v);}return v;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const c=grid[y][x];if(!c)continue;
    const ink=c==='#0b1018';
    for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){
      let a=0;
      if(!ink){
        if(sy===0&&grid[y-1]?.[x]!==c)a=.25;
        else if(sx===0&&grid[y]?.[x-1]!==c)a=.13;
        else if(sy===3&&grid[y+1]?.[x]!==c)a=-.26;
        else if(sx===3&&grid[y]?.[x+1]!==c)a=-.18;
        else if(metal&&(x*4+sx+y*2)%15===3)a=.35;
        else if(cloth&&(x*4+sx)%3===0&&(y*4+sy)%3===0)a=-.13;
        else if(leather&&sx===1&&sy===2&&(x+y)%2===0)a=-.24;
      }
      out[y*4+sy][x*4+sx]=a?tint(c,a):c;
    }
  }
  return gridToPaths(out,.25);
}
