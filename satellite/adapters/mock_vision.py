import time
import random
from typing import Optional
from core.interfaces import ICamera, IOcrEngine, VisionRead

class MockCamera(ICamera):
    def get_frame(self) -> bytes:
        # Simula o tempo de captura de ecrã (Otimização CPU)
        time.sleep(0.5) 
        return b"mock_frame_data"

class MockOcrEngine(IOcrEngine):
    def __init__(self):
        # Sequência predefinida para teste (Ganha 2 vezes, Perde 1)
        self.test_sequence = [32, 15, 10, 32]
        self.index = 0

    def extract_number(self, frame: bytes) -> Optional[VisionRead]:
        time.sleep(0.1) # Simula latência do OCR
        
        # Simula falha na leitura (Ruído visual, bola a girar)
        if random.random() < 0.3:
            return None 

        if self.index < len(self.test_sequence):
            num = self.test_sequence[self.index]
            self.index += 1
            return VisionRead(sector=num, dealer_id="D_ALICE", confidence=0.98)
        
        return None
