"""Render source pixel grids at integer scale with nearest-neighbor enlargement."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
j=json.load(open(sys.argv[1])); out=Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
bg='#101020';text='#e6e6f2';muted='#a6a6bb';accent='#b392ff'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
big=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',25)
def tile(grid,scale=3):
 im=Image.new('RGBA',(len(grid[0]),len(grid)))
 for y,row in enumerate(grid):
  for x,c in enumerate(row):
   if c: im.putpixel((x,y),tuple(bytes.fromhex(c[1:]))+(255,))
 return im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
def place(im,grid,x,y,s=3):
 t=tile(grid,s);im.paste(t,(x,y),t)
def label(d,p,s,f=font,c=text): d.text(p,s,font=f,fill=c)
# Transparent assets at native resolution: alpha is always 0 or 255.
native=Image.new('RGBA',(44*len(j['players']),44))
for i,p in enumerate(j['players']):place(native,p['grid'],i*44,0,1)
native.save(out/'update50-player44-native.png')
atlas=Image.new('RGBA',(64*8,64*5))
for row,key in enumerate(['run','dribble','shoot','dunk','defense']):
 for col,a in enumerate(j['animations']):place(atlas,a[key],col*64,row*64,1)
atlas.save(out/'update50-player44-poses.png')
im=Image.new('RGB',(1180,1550),bg);d=ImageDraw.Draw(im)
label(d,(28,22),'COURTVISION / 44px player art',big)
label(d,(28,58),'Native pixel grids • Actual game renderer • Integer-scale preview',font,muted)
for i,p in enumerate(j['players']):
 place(im,p['grid'],30+i*192,95,4);label(d,(30+i*192,282),p['name'],small)
label(d,(28,320),'Eight directions',big)
for i,p in enumerate(j['views']):
 place(im,p['grid'],10+i*146,360,2);label(d,(18+i*146,500),p['name'],small)
for row,(key,title) in enumerate([('run','Run'),('dribble','Moving dribble'),('shoot','Jump shot'),('dunk','Dunk'),('defense','Defense')]):
 y=542+row*160;label(d,(28,y),title,font,accent)
 for i,a in enumerate(j['animations']):place(im,a[key],10+i*146,y+22,2)
label(d,(28,1365),'Saved custom outfits',big)
for i,p in enumerate(j['cosmetics']):
 place(im,p['grid'],45+i*192,1400,2);label(d,(45+i*192,1512),p['name'],small)
im.save(out/'update50-player44.png')
frames=[]
for frame in j['animations']:
 im=Image.new('RGB',(1100,330),bg);d=ImageDraw.Draw(im)
 label(d,(25,15),'COURTVISION / actual pixel animation',big)
 for i,(key,title) in enumerate([('run','Run'),('dribble','Dribble'),('shoot','Shoot'),('dunk','Dunk'),('defense','Defense')]):
  place(im,frame[key],12+i*218,65,3);label(d,(55+i*218,280),title,font)
 frames.append(im)
# GIF has 10 ms time units. Alternating 60/70 ms totals exactly 500 ms per eight-frame cycle.
frames[0].save(out/'update50-player44.gif',save_all=True,append_images=frames[1:],duration=[60,60,70,60,60,60,70,60],loop=0,disposal=2)
