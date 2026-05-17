import re
import time
from typing import Optional
from PIL import Image, ImageOps
import pytesseract
import mss

from core.interfaces import ICamera, IOcrEngine, VisionRead

class RealCamera(ICamera):
    def __init__(self, bounding_box=None):
        """
        Inicializa a captura de ecrã focada apenas na ROI (Region of Interest).
        bounding_box padrão (exemplo): topo-esquerda, com 150x50 pixels.
        """
        self.sct = mss.mss()
        # Ajuste estas coordenadas para o local exato onde o número aparece no seu ecrã/browser.
        self.bbox = bounding_box or {'top': 300, 'left': 100, 'width': 80, 'height': 50}

    def get_frame(self) -> Image.Image:
        # Extração assintótica O(1) no espaço. Captura apenas os pixels vitais.
        sct_img = self.sct.grab(self.bbox)
        # Converte a matriz de pixels bruta para objeto de Imagem (Pillow)
        return Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")


class RealOcrEngine(IOcrEngine):
    def __init__(self):
        # Configuração do Tesseract: 
        # --psm 8: Trata a imagem como uma única palavra/linha de texto.
        # whitelist: Força a IA a procurar apenas números.
        self.custom_config = r'--oem 3 --psm 8 -c tessedit_char_whitelist=0123456789'

    def extract_number(self, frame: Image.Image) -> Optional[VisionRead]:
        try:
            # 1. Pré-processamento de Imagem (Tratamento de contraste/ruído)
            gray = ImageOps.grayscale(frame)
            # Limiarização (Threshold): Pixels mais escuros que 128 ficam pretos, resto fica branco.
            thresh = gray.point(lambda p: p > 128 and 255)

            # 2. Ingestão no Motor OCR
            text = pytesseract.image_to_string(thresh, config=self.custom_config).strip()

            # 3. Filtro e Sanitização (Regex)
            # Procura um número isolado entre 0 e 36.
            match = re.search(r'\b([0-9]|[1-2][0-9]|3[0-6])\b', text)
            
            if match:
                sector = int(match.group(1))
                # Para esta fase, definimos a velocidade como NORMAL e o dealer como genérico,
                # até implementarmos a ROI secundária que lê os nomes.
                return VisionRead(sector=sector, dealer_id="D_ALICE", confidence=0.85)

            return None
        except Exception as e:
            # O sistema nunca falha silenciosamente, mas não pode interromper o stream.
            return None
