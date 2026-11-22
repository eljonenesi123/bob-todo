# Builds the "Tally" icon SVGs for Bob from one set of shapes.
import os, sys

OUT = sys.argv[1]
DESK, PAPER, YELLOW, RULE = '#2B2D31', '#D9DADC', '#FFC93C', '#3A3C42'

# Mark drawn around (512, 512) in a 1024 box: four hand-drawn pen strokes + one highlighter stroke
STROKES = [  # (x top, y top, x bottom, y bottom, wobble)
    (355, 297, 353, 727, -4),
    (453, 292, 457, 732, 5),
    (550, 299, 546, 723, -3),
    (647, 293, 650, 728, 4),
]
BAR = ((285, 641), (739, 380))  # centerline of the highlighter swipe


def mark(stroke_w=44, bar_w=70):
    paths = []
    for x1, y1, x2, y2, w in STROKES:
        mx, my = (x1 + x2) / 2 + w, (y1 + y2) / 2
        paths.append(f'<path d="M{x1} {y1} Q{mx} {my} {x2} {y2}" />')
    (bx1, by1), (bx2, by2) = BAR
    return (f'<g fill="none" stroke="{PAPER}" stroke-width="{stroke_w}" stroke-linecap="round">{"".join(paths)}</g>'
            f'<line x1="{bx1}" y1="{by1}" x2="{bx2}" y2="{by2}" stroke="{YELLOW}" stroke-width="{bar_w}" />')


def rules():
    return ''.join(f'<rect x="0" y="{y - 3}" width="1024" height="6" fill="{RULE}" />' for y in range(180, 1000, 120))


def svg(body, rx=0):
    bg = f'<rect width="1024" height="1024" rx="{rx}" fill="{DESK}" />'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{bg}{body}</svg>\n'


def scaled(body, s):
    return f'<g transform="translate(512 512) scale({s}) translate(-512 -512)">{body}</g>'


files = {
    # Full-bleed square: iOS and Android round the corners themselves
    'icon.svg': svg(rules() + mark()),
    # Maskable: same art, mark shrunk so it stays inside the 40% safe-zone circle
    'maskable.svg': svg(rules() + scaled(mark(), 0.78)),
    # Favicon: rounded, no ruled lines, thicker marks so it reads at 16px
    'favicon.svg': svg(scaled(mark(stroke_w=64, bar_w=96), 1.15), rx=200),
}
os.makedirs(OUT, exist_ok=True)
for name, text in files.items():
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(text)
print('wrote', ', '.join(files))
