from PIL import Image

im = Image.open(r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\verified_screenshot.png")
dialog_crop = im.crop((180, 40, 1080, 560))
dialog_crop.save(r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\dialog_crop.png")
print("Dialog cropped.")

