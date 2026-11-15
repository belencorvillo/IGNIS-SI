import albumentations as A
import cv2
import os
import shutil
import random
from glob import glob

# --- CONFIGURACIÓN ---
IMG_SOURCE_DIR = "dataset_yolo/images/train"
LBL_SOURCE_DIR = "dataset_yolo/labels/train"

num_copias_por_archivo = 10  # Cada imagen original generará 23 variaciones
val_percent = 0.20           # 20% de las nuevas imágenes irán a 'val'

# --- PREPARACIÓN DE DIRECTORIOS ---
output_dirs = {
    "train": {"images": "dataset_yolo/images/train", "labels": "dataset_yolo/labels/train"},
    "val": {"images": "dataset_yolo/images/val", "labels": "dataset_yolo/labels/val"}
}

for split in output_dirs:
    os.makedirs(output_dirs[split]["images"], exist_ok=True)
    os.makedirs(output_dirs[split]["labels"], exist_ok=True)

# --- PIPELINE DE TRANSFORMACIONES (Sin cambios geométricos) ---
#poner mucho menos ruido gaussiano y menos blur
transform = A.Compose([
    A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.7),
    A.GaussNoise(var_limit=(1.0, 3.0), p=0.3),
    A.RGBShift(r_shift_limit=20, g_shift_limit=20, b_shift_limit=20, p=0.5),
])

# --- BUSCAR TODAS LAS IMÁGENES ---
# Soporta jpg, jpeg y png
image_extensions = ('*.png', '*.jpg', '*.jpeg')
image_files = []
for ext in image_extensions:
    image_files.extend(glob(os.path.join(IMG_SOURCE_DIR, ext)))

print(f"Encontradas {len(image_files)} imágenes originales.")

# --- BUCLE DE PROCESAMIENTO ---
for img_path in image_files:
    base_name = os.path.splitext(os.path.basename(img_path))[0]
    txt_path = os.path.join(LBL_SOURCE_DIR, f"{base_name}.txt")
    
    # Verificar si existe el TXT de pose correspondiente
    if not os.path.exists(txt_path):
        print(f"⚠️ Saltando {base_name}: No se encontró archivo de etiqueta .txt")
        continue

    # Cargar imagen original
    image = cv2.imread(img_path)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Definir destinos aleatorios para las copias de este archivo específico
    num_val = int(num_copias_por_archivo * val_percent)
    destinations = ["val"] * num_val + ["train"] * (num_copias_por_archivo - num_val)
    random.shuffle(destinations)

    print(f"Procesando '{base_name}' -> Generando {num_copias_por_archivo} copias...")

    for i, split in enumerate(destinations):
        # 1. Aplicar transformación
        augmented = transform(image=image)
        image_aug = augmented['image']
        image_aug = cv2.cvtColor(image_aug, cv2.COLOR_RGB2BGR)
        
        # 2. Definir rutas
        nuevo_nombre = f"{base_name}_aug_{i}"
        path_img_final = os.path.join(output_dirs[split]["images"], f"{nuevo_nombre}.jpg")
        path_txt_final = os.path.join(output_dirs[split]["labels"], f"{nuevo_nombre}.txt")
        
        # 3. Guardar imagen aumentada
        cv2.imwrite(path_img_final, image_aug)
        
        # 4. Copiar etiqueta original al nuevo nombre
        shutil.copyfile(txt_path, path_txt_final)

print("\n✅ ¡Proceso masivo terminado con éxito!")
