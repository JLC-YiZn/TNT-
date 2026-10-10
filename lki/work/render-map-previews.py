import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path('work')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
sheet=Image.new('RGB',(1240,1110),(16,24,33))
draw=ImageDraw.Draw(sheet)
for i,entry in enumerate(json.loads((root/'map-previews.json').read_text(encoding='utf-8'))):
    x=20+(i%2)*610;y=20+(i//2)*365
    image=Image.frombytes('RGBA',(1200,650),(root/entry['file']).read_bytes()).resize((590,320))
    bg=Image.new('RGB',image.size,(31,65,73));bg.paste(image,(0,0),image)
    sheet.paste(bg,(x,y+30));draw.text((x,y),entry['name']+' / TNT-2026',font=font,fill=(231,215,162))
    for sx in (160,1030):
        px=x+sx*590/1200;py=y+30+460*320/650
        draw.ellipse((px-5,py-8,px+5,py+2),fill=(241,198,109))
draw.text((650,815),'四种材质：土层 / 岩石 / 砖墙 / 冰层',font=font,fill=(230,230,230))
draw.text((650,860),'相同种子可复现地形；每次爆炸累计损耗强度。',font=small,fill=(180,195,205))
sheet.save(root/'map-contact-sheet.png')
