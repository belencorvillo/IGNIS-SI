from ultralytics import YOLO

model = YOLO('yolo26n.pt') 

# Entrenar desactivando el mosaico y el mezclado
model.train(
    data='dataset_yolo/dataset.yaml', 
    epochs=60,
    imgsz=1024,          
    batch=8,
)
