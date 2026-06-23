import os
import time
from rlsys_core import RLSysCore

class SystemHUD:
    def __init__(self):
        self.core = RLSysCore()
        self.running = True

    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')

    def display_header(self):
        self.clear_screen()
        print("======================================================")
        print(" RL.SYS CORE V5.10b - TERMINAL INSTITUCIONAL          ")
        print("======================================================")
        print(f" Banca Atual   : R$ {self.core.bankroll:.2f}")
        print(f" Jornada Macro : R$ {self.core.macro_goal:.2f}")
        print(f" Provedor Ativo: {self.core.provider.upper()}")
        print("======================================================")
        print(" Comandos: enable <id> | disable <id> | weights")
        print("======================================================")

    def cmd_weights(self):
        self.clear_screen()
        print("RL.SYS CORE - SHADOW TRADING & RL WEIGHTS")
        print("======================================================")
        for strat, data in self.core.strategy_manager.strategies.items():
            # Injeção visual indestrutível de estado na renderização
            status = "[ ON ]" if data["active"] else "[OFF ]"
            
            pnl_val = data['pnl']
            pnl_str = f"+{pnl_val:.2f}" if pnl_val > 0 else f"{pnl_val:.2f}"
            
            print(f" {status} Estratégia: {strat:<20} | PnL Monetário: {pnl_str:>6} | Peso RL: {data['weight']:.2f}")
        print("======================================================")
        input("Pressione ENTER para retornar ao HUD...")

    def parse_strategy_name(self, args):
        raw = "_".join(args).upper().strip()
        return raw.replace("-", "_").replace(" ", "_")

    def execute_command(self, command_line):
        parts = command_line.strip().split()
        if not parts: return

        cmd = parts[0].lower()
        args = parts[1:]

        if cmd == "setbankroll" and args: self.core.bankroll = float(args[0])
        elif cmd == "setmacro" and args: self.core.macro_goal = float(args[0])
        elif cmd == "provider" and args: self.core.provider = args[0]
        
        elif cmd == "weights":
            self.cmd_weights()
            
        elif cmd == "disable" and args:
            strat = self.parse_strategy_name(args)
            if self.core.strategy_manager.disable_strategy(strat):
                print(f"\n[SISTEMA] Reator da Estratégia {strat} DESLIGADO do motor.")
            else:
                print(f"\n[ERRO] Estratégia '{strat}' nao cadastrada.")
            time.sleep(1)
                
        elif cmd == "enable" and args:
            strat = self.parse_strategy_name(args)
            if self.core.strategy_manager.enable_strategy(strat):
                print(f"\n[SISTEMA] Reator da Estratégia {strat} LIGADO ao motor.")
            else:
                print(f"\n[ERRO] Estratégia '{strat}' nao cadastrada.")
            time.sleep(1)
                
        elif cmd == "backtest" and args:
            self.core.run_backtest(args[0])
            input("\nPressione ENTER para retornar...")
            
        elif cmd in ["exit", "quit"]:
            print("\n[SISTEMA] Selando processos do terminal...")
            self.running = False
        else:
            print(f"\n[ERRO] Comando nao reconhecido.")
            time.sleep(1)

    def start_loop(self):
        while self.running:
            self.display_header()
            try:
                cmd_input = input("rlsys-terminal > ")
                self.execute_command(cmd_input)
            except KeyboardInterrupt:
                print("\n\n[SISTEMA] Interrupcao forçada. Fechando.")
                break

if __name__ == "__main__":
    terminal = SystemHUD()
    terminal.start_loop()
