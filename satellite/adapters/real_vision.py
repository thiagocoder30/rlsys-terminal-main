import subprocess
import os
import time
from typing import Optional
from PIL import Image
import pytesseract
from core.interfaces import ICamera, IOcrEngine, VisionRead

class RealCamera(ICamera):
    def __init__(self, bounding_box=None):
        self.bbox = {'top': 230, 'left': 480, 'width': 65, 'height': 55}
        self.temp_path = "/sdcard/Download/mira_debug.png"
        # CAMINHO ABSOLUTO DIRETO DO ANDROID (Evita o Shell do Linux)
        self.bin_path = "/data/data/com.termux/files/usr/bin/termux-screenshot"

    def get_frame(self) -> Image.Image:
        try:
            # Chamada direta ao binário sem passar pelo wrapper
            subprocess.run([self.bin_path, "-f", self.temp_path], 
                           check=True, capture_output=False, timeout=12)
            
            # O A10s precisa de tempo para escrever no disco (MMC lento)
            time.sleep(0.8) 
            
            if os.path.exists(self.temp_path):
                with Image.open(self.temp_path) as img:
                    return img.crop((self.bbox['left'], self.bbox['top'], 
                                     self.bbox['left']+self.bbox['width'], 
                                     self.bbox['top']+self.bbox['height'])).copy()
            return Image.new('RGB', (65, 55), (0, 0, 0))
        except Exception as e:
            return Image.new('RGB', (65, 55), (0, 0, 0))

class RealOcrEngine(IOcrEngine):
    def __init__(self):
        # Configuração de baixo consumo para o processador Helio P22
        self.config = r'--oem 3 --psm 8 -c tessedit_char_whitelist=0123456789'

    def extract_number(self, frame: Image.Image) -> Optional[VisionRead]:
        try:
            text = pytesseract.image_to_string(frame, config=self.config).strip()
            if text.isdigit():
                return VisionRead(sector=int(text), dealer_id="D_ALICE", confidence=0.80)
            return None
        except:
            return None
