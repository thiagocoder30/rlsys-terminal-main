class StrategyManager:
    def __init__(self):
        # Banco de dados sincronizado com os ultimos pesos reais reportados
        self.strategies = {
            "CROSS_GRID_HEDGE": {"active": True, "pnl": 30.00, "weight": 2.50},
            "FUSION_REDUZIDA": {"active": True, "pnl": 12.81, "weight": 0.47},
            "TRIPLICACAO_RED": {"active": True, "pnl": 3.00, "weight": 0.24},
            "TRIPLICACAO_BLACK": {"active": True, "pnl": -13.00, "weight": 0.10},
            "TRIPLICACAO_EVEN": {"active": True, "pnl": -13.00, "weight": 0.12},
            "TRIPLICACAO_ODD": {"active": True, "pnl": 3.00, "weight": 0.16},
            "SECTOR_VOISINS": {"active": True, "pnl": -61.80, "weight": 0.10},
            "SECTOR_TIERS": {"active": True, "pnl": -15.00, "weight": 0.10},
            "SECTOR_ORPHELINS": {"active": True, "pnl": 61.50, "weight": 0.11}
        }

    def get_active_strategies(self):
        return {k: v for k, v in self.strategies.items() if v["active"]}

    def disable_strategy(self, name):
        name_upper = name.upper().strip()
        if name_upper in self.strategies:
            self.strategies[name_upper]["active"] = False
            return True
        return False

    def enable_strategy(self, name):
        name_upper = name.upper().strip()
        if name_upper in self.strategies:
            self.strategies[name_upper]["active"] = True
            return True
        return False
