
from PIL import Image, ImageDraw, ImageFont
import os

OUT = "/home/claude/cota/public/assets/images"
os.makedirs(OUT, exist_ok=True)

def font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except Exception:
        return ImageFont.load_default()

def draw_centered(draw, xy_box, text, f, fill):
    x0, y0, x1, y1 = xy_box
    lines = text.split("\n")
    total_h = sum((draw.textbbox((0,0), ln, font=f)[3] for ln in lines)) + (len(lines)-1)*6
    cy = y0 + ((y1-y0) - total_h) / 2
    for ln in lines:
        bbox = draw.textbbox((0,0), ln, font=f)
        w = bbox[2]-bbox[0]
        h = bbox[3]-bbox[1]
        cx = x0 + ((x1-x0) - w) / 2
        draw.text((cx, cy), ln, font=f, fill=fill)
        cy += h + 6

def render_placeholder(path, w, h, base, label, sublabel=""):
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img)
    # diagonal hazard stripes to signal "placeholder"
    stripe = tuple(min(255, c+18) for c in base)
    step = 28
    for x in range(-h, w, step):
        d.line([(x, h), (x+h, 0)], fill=stripe, width=10)
    d.rectangle([0,0,w-1,h-1], outline=(255,255,255), width=3)
    draw_centered(d, (10, h*0.38, w-10, h*0.62), label, font(max(14, w//18)), (255,255,255))
    if sublabel:
        draw_centered(d, (10, h*0.66, w-10, h*0.82), sublabel, font(max(10, w//30)), (220,220,220))
    draw_centered(d, (10, 8, w-10, 34), "PLACEHOLDER — REPLACE ME", font(14), (255,80,80))
    img.save(path, "PNG")

characters = [
    ("fum","Fumio"),("ali","Alicia"),("vys","Vyse"),("riku","Riku.EXE"),
    ("emm","Emma"),("kar","Karin"),("fko","Fumiko"),("set","Setsuna"),
    ("shi","Shioriko"),("rik","Rikki"),("geo","George"),("mak","Makoto"),
    ("meg","Megumi"),("mea","Meari"),("han","Hanzo"),("sat","Satoshi"),
    ("mic","Michan"),
]


for code, name in characters:
    render_placeholder(f"{OUT}/render_{code}.png", 600, 900, (35,35,45),
                        name.upper(), "FULL BODY RENDER")


for code, name in characters:
    render_placeholder(f"{OUT}/splash_{code}.png", 900, 1200, (20,20,28),
                        name.upper(), "SPLASH ART")


for code, name in characters:
    render_placeholder(f"{OUT}/graffiti_{code}.png", 1000, 360, (24,18,32),
                        name.upper(), "GRAFFITI NAME ART")


render_placeholder(f"{OUT}/relationship_bg.jpg".replace('.jpg','.png'), 1920, 1080, (18,22,30),
                    "NIJIGASAKI", "RELATIONSHIP TAB BACKGROUND")
render_placeholder(f"{OUT}/lore_bg.png", 1920, 1080, (14,14,20),
                    "LORE TAB", "ANIMATED / MOVING BACKGROUND (GIF PREFERRED)")
render_placeholder(f"{OUT}/char_select_bg.png", 1920, 1080, (10,10,14),
                    "CHARACTER SELECT", "DARK ATMOSPHERIC FIGHTING-GAME BACKGROUND")
render_placeholder(f"{OUT}/home_hero_bg.png", 1920, 1080, (16,12,22),
                    "HOME HERO", "BACKGROUND")
render_placeholder(f"{OUT}/nijigasaki_bg.png", 1920, 1080, (22,30,44),
                    "NIJIGASAKI SCHOOL", "2ND GEN INDEX BACKGROUND")
render_placeholder(f"{OUT}/irregular_hunter_base_bg.png", 1920, 1080, (30,20,20),
                    "IRREGULAR HUNTER BASE", "1ST GEN INDEX BACKGROUND")
render_placeholder(f"{OUT}/app_logo.png", 240, 240, (25,25,35), "C.O.T.A.", "LOGO")

print("done")
