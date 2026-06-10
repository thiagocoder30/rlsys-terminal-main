#!/usr/bin/env python3
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request


def fail(message: str, code: int = 1) -> None:
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False, indent=2))
    sys.exit(code)


def mime_for(path: str) -> str:
    guessed, _ = mimetypes.guess_type(path)
    return guessed or "image/png"


def main() -> None:
    if len(sys.argv) < 3:
        fail("Uso: python3 scripts/extrator_gemini.py <screenshot.png> <saida.extracted.json>")

    image_path = sys.argv[1]
    output_path = sys.argv[2]

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    model = os.environ.get("RLSYS_GEMINI_MODEL", "gemini-2.0-flash").strip()

    if not api_key:
        fail("GEMINI_API_KEY não configurada. Exporte a chave antes de rodar o extrator.")

    if not os.path.isfile(image_path):
        fail(f"Imagem não encontrada: {image_path}")

    with open(image_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("ascii")

    prompt = (
        "Você é um extrator de histórico de roleta para PAPER trading defensivo. "
        "Extraia somente a sequência das últimas rodadas visíveis no print, na ordem exibida do histórico. "
        "Retorne APENAS JSON válido no formato: {\"rounds\":[...]}.\n"
        "Use números inteiros de 0 a 36 quando o número estiver visível. "
        "Se só a cor estiver visível, use 'V' para vermelho, 'P' para preto e '0' para zero. "
        "Não explique, não recomende entrada e não invente resultados."
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_for(image_path),
                            "data": encoded,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "response_mime_type": "application/json",
        },
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        fail(f"Erro HTTP Gemini: {error.code} {error.read().decode('utf-8', errors='ignore')}")
    except Exception as error:
        fail(f"Erro ao chamar Gemini: {error}")

    data = json.loads(raw)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    extracted = json.loads(text)

    rounds = extracted.get("rounds")
    if not isinstance(rounds, list):
        fail("Resposta Gemini não contém array 'rounds'.")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    report = {
        "ok": True,
        "source": image_path,
        "model": model,
        "rounds": rounds,
        "count": len(rounds),
        "paperOnly": True,
        "liveMoneyAuthorization": False,
        "automaticExecutionAllowed": False,
        "automaticBetExecutionAllowed": False,
        "humanSupervisionRequired": True,
    }

    with open(output_path, "w", encoding="utf-8") as output_file:
        json.dump(report, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
