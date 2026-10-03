import type { FrameId } from '../profile/profile';

type Ctx = CanvasRenderingContext2D;
/** Engraved corner fittings and edge inlays, kept outside the share card's text safe area. */
export function cardFrameFinish(ctx: Ctx, frame: FrameId, x: number, y: number, w: number, h: number, accent: string, light: string) {
  ctx.save();
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const gem=['gold','diamond','jade','royal','legend','sovereign','rainbow','galaxy'].includes(frame);
  const tech=['neon','pixel','lightning'].includes(frame);
  const fire=frame==='fire'||frame==='ember';
  const frost=frame==='ice';
  for(const [cx,cy,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){
    ctx.save();ctx.translate(cx,cy);ctx.scale(sx,sy);
    ctx.fillStyle='#080d18';
    ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(28,-5);ctx.lineTo(28,3);ctx.lineTo(16,3);ctx.lineTo(16,16);ctx.lineTo(3,16);ctx.lineTo(3,28);ctx.lineTo(-5,28);ctx.closePath();ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle=light;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2,24);ctx.lineTo(-2,-2);ctx.lineTo(24,-2);ctx.stroke();
    if(gem){
      ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(14,7);ctx.lineTo(7,14);ctx.lineTo(0,7);ctx.closePath();ctx.fill();
      ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(7,1);ctx.lineTo(7,7);ctx.lineTo(1,7);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffffff';ctx.globalAlpha=.7;ctx.fillRect(5,3,2,2);ctx.globalAlpha=1;
    }else if(tech){
      ctx.strokeStyle=light;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(6,22);ctx.lineTo(6,6);ctx.lineTo(22,6);ctx.stroke();ctx.fillStyle=accent;ctx.fillRect(20,4,4,4);ctx.fillRect(4,20,4,4);
    }else if(fire||frost){
      ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(4,4);ctx.lineTo(10,0);ctx.lineTo(9,7);ctx.lineTo(16,6);ctx.lineTo(10,15);ctx.closePath();ctx.fill();ctx.fillStyle=light;ctx.fillRect(5,6,4,5);
    }else{
      ctx.fillStyle=accent;ctx.fillRect(2,2,10,10);ctx.fillStyle=light;ctx.fillRect(3,3,8,2);ctx.fillStyle='#543520';ctx.fillRect(5,7,4,1);
    }
    ctx.restore();
  }
  // Small symmetrical details on the edge; they never cover headlines or statistics.
  for(const yy of [y,y+h]){
    ctx.fillStyle=accent;ctx.fillRect(x+w/2-33,yy-1,22,2);ctx.fillRect(x+w/2+11,yy-1,22,2);
    ctx.fillStyle=light;ctx.fillRect(x+w/2-3,yy-3,6,6);
    if(tech){ctx.fillRect(x+w/2-45,yy-2,4,4);ctx.fillRect(x+w/2+41,yy-2,4,4);}
  }
  ctx.restore();
}
