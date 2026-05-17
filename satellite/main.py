import sys
import json
import time
from adapters.real_vision import RealCamera, RealOcrEngine

def run_satellite():
    """
    Motor Cibernético: Loop de Visão Real.
    """
    # Defina aqui as coordenadas (X, Y, Largura, Altura) da caixa onde os números aparecem.
    roi_coords = {'top': 250, 'left': 50, 'width': 100, 'height': 60}
    
    camera = RealCamera(bounding_box=roi_coords)
    ocr = RealOcrEngine()
    
    # Aguarda o Node.js inicializar
    time.sleep(2)

    try:
        while True:
            # Captura ultra-rápida (só a caixa)
            frame = camera.get_frame()
            
            # Reconhecimento ótico
            read_result = ocr.extract_number(frame)
            
            # Comunicação Unix Pipe
            if read_result:
                payload = {
                    "sector": read_result.sector,
                    "dealerId": read_result.dealer_id,
                    "speed": "NORMAL"
                }
                print(json.dumps(payload), flush=True)
                
                # Debounce na visão: Após uma leitura bem sucedida, descansa o CPU por 3 segundos
                time.sleep(3)
            else:
                # Se não viu nada, descansa brevemente para não esgotar o CPU (30 FPS max)
                time.sleep(0.033)

    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    run_satellite()
