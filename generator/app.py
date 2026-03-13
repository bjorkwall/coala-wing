import os
import base64
import zipfile
import tempfile
from io import BytesIO
from PIL import Image
import gradio as gr
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SPRITES = [
    ("idle_left", "Standing facing left"),
    ("walk_left", "Walking facing left (one step forward)"),
    ("jump", "Jump pose with knees slightly bent"),
]

PROMPT_BASE = """
Create a clean 2D game sprite from the uploaded character.

Requirements:
- Keep the character design identical
- Transparent background
- No shadows
- No glow
- No background elements
- Clean edges suitable for game sprites
- Character facing left unless otherwise specified
"""

def generate_sprite(image, pose_prompt):
    prompt = PROMPT_BASE + "\nPose: " + pose_prompt

    with BytesIO() as buffer:
        image.save(buffer, format="PNG")
        buffer.seek(0)

        result = client.images.edit(
            model="gpt-image-1",
            image=buffer,
            prompt=prompt,
            background="transparent",
            size="1024x1024",
        )

    img_base64 = result.data[0].b64_json
    img_bytes = base64.b64decode(img_base64)

    return Image.open(BytesIO(img_bytes)).convert("RGBA")


def normalize_height(images):
    heights = [img.height for img in images]
    target_height = max(heights)

    normalized = []

    for img in images:
        ratio = target_height / img.height
        new_width = int(img.width * ratio)
        resized = img.resize((new_width, target_height), Image.LANCZOS)
        normalized.append(resized)

    return normalized


def mirror(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def process_image(image):

    generated = []

    for name, pose in SPRITES:
        img = generate_sprite(image, pose)
        generated.append((name, img))

    names = [n for n, _ in generated]
    imgs = [i for _, i in generated]

    imgs = normalize_height(imgs)

    idle_left, walk_left, jump = imgs

    sprites = {
        "idle_left.png": idle_left,
        "idle_right.png": mirror(idle_left),
        "walk_left.png": walk_left,
        "walk_right.png": mirror(walk_left),
        "jump.png": jump,
    }

    tmpdir = tempfile.mkdtemp()
    zip_path = os.path.join(tmpdir, "sprites.zip")

    with zipfile.ZipFile(zip_path, "w") as zipf:
        for filename, img in sprites.items():
            path = os.path.join(tmpdir, filename)
            img.save(path)
            zipf.write(path, filename)

    return zip_path


interface = gr.Interface(
    fn=process_image,
    inputs=gr.Image(type="pil", label="Drag character image here"),
    outputs=gr.File(label="Download sprites"),
    title="Sprite Generator",
    description="Upload one character image and receive game sprites.",
)

interface.launch()