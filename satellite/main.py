import sys
import json
import time
from adapters.mock_vision import MockCamera, MockOcrEngine

def run_satellite():
    """
    Loop principal de visão computacional.
    Complexidade Espacial O(1): Frames são descartados instantaneamente.
    """
    camera = MockCamera()
    ocr = MockOcrEngine()
    
    # Para garantir que o Node.js tenha tempo de arrancar antes do Python "gritar" dados
    time.sleep(2)

    try:
        while True:
            # 1. Tira a foto (ROI)
            frame = camera.get_frame()
            
            # 2. Extrai o texto
            read_result = ocr.extract_number(frame)
            
            # 3. Se encontrou um número, envia via Standard Output (Pipe)
            if read_result:
                payload = {
                    "sector": read_result.sector,
                    "dealerId": read_result.dealer_id
                }
                
                # flush=True garante latência zero no Pipe do Linux
                print(json.dumps(payload), flush=True)
                
                # Cooldown nativo após uma leitura de sucesso para poupar bateria
                time.sleep(2) 
            
            # Limite para o teste não rodar infinitamente (encerra após a sequência do Mock)
            if ocr.index >= len(ocr.test_sequence):
                time.sleep(3) # Espera o Node terminar o log
                break

    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    run_satellite()
