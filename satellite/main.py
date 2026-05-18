import sys
import json
import time
from adapters.real_vision import RealCamera, RealOcrEngine

def run_satellite():
    # Coordenadas calibradas para o 1º número da timeline (Ex: 31)
    roi_evolution = {'top': 180, 'left': 460, 'width': 55, 'height': 45}
    
    camera = RealCamera(bounding_box=roi_evolution)
    ocr = RealOcrEngine()
    
    time.sleep(2)

    try:
        while True:
            frame = camera.get_frame()
            
            # MODO DEBUG: Guarda a foto da mira no disco para validação
            frame.save("mira_debug.png")
            
            read_result = ocr.extract_number(frame)
            
            if read_result:
                payload = {
                    "sector": read_result.sector,
                    "dealerId": read_result.dealer_id,
                    "speed": "NORMAL"
                }
                print(json.dumps(payload), flush=True)
                time.sleep(3)
            else:
                time.sleep(0.033)

    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    run_satellite()
