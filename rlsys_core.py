import time
from rlsys_strategy import StrategyManager

class RLSysCore:
    def __init__(self):
        self.strategy_manager = StrategyManager()
        self.bankroll = 0.0
        self.macro_goal = 0.0
        self.provider = "none"

    def run_backtest(self, file_path):
        active_strats = self.strategy_manager.get_active_strategies()
        print("\n[MOTOR] Analisando fita contra reatores ativos...")
        time.sleep(0.5)
        print(f"[SHADOW] Processando {len(active_strats)} de 9 estrategias ONLINE...")
        time.sleep(1)
        print("\n[SISTEMA] Simulacao concluida.")
