import cv2
from ultralytics import YOLO

# 1. Rutas de los archivos
# Si hiciste el paso de ffmpeg, usa 'video_arreglado.mp4'. 
# Si quieres probar con el original, pon "_ISS_20091127_095908 177R002 Movie.mp4"
VIDEO_ENTRADA = "video_arreglado.mp4" 
VIDEO_SALIDA = "resultado_ISS.avi"

# 2. Cargar el modelo
model = YOLO('best.pt')
nombres_ingles = ['raw_fuel', 'flame', 'burning_fuel', 'fuel_residue']
model.model.names = {i: nombre for i, nombre in enumerate(nombres_ingles)}
# 3. Abrir el video
cap = cv2.VideoCapture(VIDEO_ENTRADA)

if not cap.isOpened():
    print(f"❌ Error: No se pudo abrir '{VIDEO_ENTRADA}'.")
    exit()

# Extraer propiedades
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = int(cap.get(cv2.CAP_PROP_FPS))

# 4. Configurar el video de salida (.avi con codec XVID)
fourcc = cv2.VideoWriter_fourcc(*'XVID')
out = cv2.VideoWriter(VIDEO_SALIDA, fourcc, fps, (w, h))

print(f"🎥 Procesando video ({w}x{h} a {fps} FPS)...")

frame_count = 0
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    # Hacer la predicción
    resultados = model(frame, verbose=False)
    
    # Dibujar las cajas
    frame_anotado = resultados[0].plot()
    out.write(frame_anotado)
    
    frame_count += 1
    if frame_count % 30 == 0:
        print(f"✅ Procesados {frame_count} frames...")

cap.release()
out.release()
print(f"🎉 Proceso completado. Revisa el archivo '{VIDEO_SALIDA}'.")
