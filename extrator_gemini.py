import os
import re
import json
from dotenv import load_dotenv
from google import genai

# Carrega as variáveis de ambiente do arquivo secreto .env
load_dotenv()

# Recupera a chave de acesso
CHAVE_API = os.getenv("GEMINI_API_KEY")

if not CHAVE_API:
    print("\033[91m[ERRO CRÍTICO]\033[0m Variável de ambiente GEMINI_API_KEY não localizada. Verifique o arquivo .env")
    exit()

# Inicialização do cliente com a nova arquitetura do SDK
cliente = genai.Client(api_key=CHAVE_API)

def extrair_via_nuvem():
    pasta_alvo = "/sdcard/DCIM/Screenshots/"
    print("\033[92m[SISTEMA]\033[0m Iniciando Conexão Cloud com o novo SDK Gemini...")
    
    try:
        arquivos = [f for f in os.listdir(pasta_alvo) if f.startswith('Screenshot') or f.endswith('.jpg') or f.endswith('.png')]
        if not arquivos:
            print("[ERRO] Nenhuma captura de tela identificada na pasta alvo.")
            return None

        arquivos.sort(key=lambda x: os.path.getmtime(os.path.join(pasta_alvo, x)), reverse=True)
        arquivo_atual = arquivos[0]
        caminho_completo = os.path.join(pasta_alvo, arquivo_atual)

        print(f"[{arquivo_atual}] Transmitindo matriz para o novo endpoint...")

        arquivo_upload = cliente.files.upload(file=caminho_completo)
        
        prompt = """
        Você é um sistema especializado em visão computacional e análise de dados tabulares.
        A imagem fornecida é um painel de estatísticas de uma roleta de cassino.
        
        Sua tarefa consiste em:
        1. Identificar e ler todos os números da linha de destaque superior (os resultados mais recentes, lendo da esquerda para a direita).
        2. Identificar e ler todos os números presentes no grid/painel principal inferior (linha por linha, da esquerda para a direita, de cima para baixo).
        3. Retornar APENAS os números identificados, separados estritamente por um único espaço em branco. Não adicione nenhuma introdução, explicação, pontuação ou texto extra. Apenas a sequência numérica.
        """

        resposta = cliente.models.generate_content(
            model='gemini-2.5-flash',
            contents=[arquivo_upload, prompt]
        )
        
        cliente.files.delete(name=arquivo_upload.name)

        texto_puro = resposta.text
        numeros_extraidos = re.findall(r'\b\d+\b', texto_puro)
        
        numeros_validos = [int(n) for n in numeros_extraidos if 0 <= int(n) <= 36]

        print(f"\n\033[93m[SUCESSO ABSOLUTO]\033[0m O Gemini extraiu {len(numeros_validos)} números com a nova API!")
        print(f"Últimos 15 números (Mais recentes): {numeros_validos[:15]}")
        print(f"Base do Grid (Antigos): {numeros_validos[-10:]}")
        
        # --- NOVA ASSINATURA JSON PARA O TYPESCRIPT LER ---
        print("\n===JSON_START===")
        print(json.dumps(numeros_validos))
        print("===JSON_END===")
        
        return numeros_validos
        
    except Exception as e:
        print(f"[ERRO DE API] Falha na comunicação com o servidor: {e}")
        return None

if __name__ == "__main__":
    extrair_via_nuvem()
