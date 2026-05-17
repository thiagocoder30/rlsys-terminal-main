from typing import Protocol, Optional
from dataclasses import dataclass

@dataclass
class VisionRead:
    sector: int
    dealer_id: str
    confidence: float

class ICamera(Protocol):
    def get_frame(self) -> bytes:
        """Captura um frame da região de interesse (ROI)."""
        ...

class IOcrEngine(Protocol):
    def extract_number(self, frame: bytes) -> Optional[VisionRead]:
        """Processa o frame e tenta encontrar um número válido de roleta (0-36)."""
        ...
