import os
import json
import cv2
import random
from pathlib import Path

# --- CONFIGURACIÓN ---
OUTPUT_DIR = 'dataset_yolo'
TRAIN_SPLIT = 0.8  # 80% entrenamiento, 20% validación
EXT_IMAGENES = ('.png', '.jpg', '.jpeg') # Añadido .jpeg por si acaso

# Definimos el orden oficial de las clases para que el ID sea siempre el mismo
CLASS_NAMES = ['conbustible_raw', 'llama', 'combustible_quemando', 'residuo_combustible']
class_map = {name: i for i, name in enumerate(CLASS_NAMES)}

def convert_to_yolo_format(size, box):
    dw = 1. / size[0]
    dh = 1. / size[1]
    
    xmin, xmax = min(box[0], box[2]), max(box[0], box[2])
    ymin, ymax = min(box[1], box[3]), max(box[1], box[3])
    
    x = (xmin + xmax) / 2.0
    y = (ymin + ymax) / 2.0
    w = xmax - xmin
    h = ymax - ymin
    
    return (x * dw, y * dh, w * dw, h * dh)

def obtener_pares_datos(directorios):
    pares = []
    for d in directorios:
        if not os.path.exists(d):
            print(f"⚠️ El directorio {d} no existe, saltando...")
            continue
            
        print(f"🔍 Escaneando {d}...")
        for root, _, files in os.walk(d):
            if OUTPUT_DIR in root: continue 
            
            for file in files:
                if file.lower().endswith(EXT_IMAGENES):
                    img_path = Path(root) / file
                    json_path = img_path.with_suffix('.json')
                    
                    # Guardamos el par. Si no hay JSON, pasamos None
                    if json_path.exists():
                        pares.append((img_path, json_path))
                    else:
                        pares.append((img_path, None))
    return pares

def guardar_datos(lista, subset):
    print(f"🚀 Procesando {subset} ({len(lista)} imágenes)...")
    for img_p, json_p in lista:
        # Leer imagen original
        img_cv = cv2.imread(str(img_p))
        if img_cv is None: 
            print(f"❌ Error al leer: {img_p}")
            continue
            
        h, w, _ = img_cv.shape
        # Usamos un nombre único basado en la carpeta y el nombre para evitar colisiones
        nombre_unico = f"{img_p.parent.name}_{img_p.stem}"
        
        yolo_labels = []
        
        # Si existe el JSON, leemos las etiquetas. Si es None, la lista quedará vacía.
        if json_p is not None:
            with open(json_p, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for shape in data['shapes']:
                    label = shape['label'].strip()
                    
                    # Solo procesamos si la etiqueta está en nuestra lista permitida
                    if label in class_map:
                        p = shape['points']
                        # Labelme suele guardar puntos como [[x1,y1], [x2,y2]]
                        box = [p[0][0], p[0][1], p[1][0], p[1][1]]
                        yolo_box = convert_to_yolo_format((w, h), box)
                        
                        class_id = class_map[label]
                        yolo_labels.append(f"{class_id} {' '.join([f'{c:.6f}' for c in yolo_box])}")
                    else:
                        print(f"⚠️ Etiqueta desconocida '{label}' en {json_p.name}. Saltando objeto...")

        # ELIMINADO: if not yolo_labels: continue
        # Ahora, si yolo_labels está vacío (ya sea porque no había JSON o no había etiquetas válidas), 
        # el proceso continúa para crear la imagen y un .txt vacío (imágenes de fondo/negativas).

        # Guardar Imagen (.jpg)
        dest_img = os.path.join(OUTPUT_DIR, 'images', subset, f"{nombre_unico}.jpg")
        cv2.imwrite(dest_img, img_cv, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        
        # Guardar TXT (escribirá un archivo vacío si yolo_labels no tiene elementos)
        dest_txt = os.path.join(OUTPUT_DIR, 'labels', subset, f"{nombre_unico}.txt")
        with open(dest_txt, 'w') as f_txt:
            f_txt.write("\n".join(yolo_labels))

if __name__ == "__main__":
    # 1. Preparar carpetas de salida
    for folder in ['images/train', 'images/val', 'labels/train', 'labels/val']:
        os.makedirs(os.path.join(OUTPUT_DIR, folder), exist_ok=True)

    # 2. Definir directorios de origen
    directorios_fuente = ['frames'] # Añade aquí más si es necesario

    # 3. Recopilar todos los pares de todas las carpetas
    todos_los_pares = obtener_pares_datos(directorios_fuente)
    
    if not todos_los_pares:
        print("❌ No se encontraron archivos para procesar.")
    else:
        # 4. Mezclar y dividir
        random.shuffle(todos_los_pares)
        limite = int(len(todos_los_pares) * TRAIN_SPLIT)
        train_list = todos_los_pares[:limite]
        val_list = todos_los_pares[limite:]

        # 5. Procesar y guardar
        guardar_datos(train_list, 'train')
        guardar_datos(val_list, 'val')

        # 6. Crear archivo dataset.yaml para YOLO
        with open(os.path.join(OUTPUT_DIR, 'dataset.yaml'), 'w') as f:
            f.write(f"train: images/train\n")
            f.write(f"val: images/val\n\n")
            f.write(f"nc: {len(CLASS_NAMES)}\n")
            f.write(f"names: {CLASS_NAMES}\n")

        print(f"\n✅ Proceso completado.")
        print(f"📊 Clases configuradas: {class_map}")
        print(f"📂 Dataset listo en: {os.path.abspath(OUTPUT_DIR)}")
