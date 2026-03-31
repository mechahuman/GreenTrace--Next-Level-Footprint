from PIL import Image, ImageDraw
import sys
import os

def make_circle_favicon(input_path, output_path):
    # Open image
    im = Image.open(input_path).convert("RGBA")
    
    # Crop to square
    min_dim = min(im.size)
    left = (im.width - min_dim) // 2
    top = (im.height - min_dim) // 2
    right = (im.width + min_dim) // 2
    bottom = (im.height + min_dim) // 2
    im = im.crop((left, top, right, bottom))
    
    # Create circular mask
    mask = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, min_dim, min_dim), fill=255)
    
    # Apply mask
    im.putalpha(mask)
    
    # Resize to standard favicon size (256x256 for high res)
    im.thumbnail((256, 256), Image.Resampling.LANCZOS)
    
    # Save as PNG
    im.save(output_path, format="PNG")
    print(f"Successfully saved circular favicon to {output_path}")

input_img = r"c:\COLLEGE\Third Year\CC\Innovative\favicon\Gemini_Generated_Image_fmxt1pfmxt1pfmxt.png"
output_img = r"c:\COLLEGE\Third Year\CC\Innovative\frontend\public\logo.png"

try:
    make_circle_favicon(input_img, output_img)
except Exception as e:
    print("Error:", e)
