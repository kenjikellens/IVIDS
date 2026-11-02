from PIL import Image

im = Image.open(r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\verified_screenshot.png")
# Crop footer area around y: 480 to 570
footer_crop = im.crop((150, 470, 1100, 560))
footer_crop.save(r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\footer_crop.png")
print("Footer cropped and saved.")

