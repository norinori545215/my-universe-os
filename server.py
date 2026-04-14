# server.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import json
import re

app = FastAPI()

# OS（ブラウザ）からの通信を許可する設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # どこからでもアクセス許可
    allow_methods=["*"],
    allow_headers=["*"],
)

# OSから送られてくるデータの形
class NodeData(BaseModel):
    name: str
    note: str

@app.post("/api/expand")
def expand_idea(data: NodeData):
    print(f"受信した信号: {data.name}")
    
    # 賢いモデル（llama3）に投げるプロンプト
    prompt = f"""
    あなたは天才的なアイデア発想AIです。
    以下の「元のデータ」から連想される【新しいアイデア】や【IF展開】を、全く異なる視点から「3つ」考えてください。

    【元のデータ】
    タイトル: {data.name}
    詳細な記憶: {data.note if data.note else 'なし'}

    【絶対のルール】
    必ず以下のJSON配列フォーマット「のみ」を出力してください。他の文章は一切不要です。
    [
      {{ "name": "具体的な単語やタイトル1", "note": "その詳しい説明や展開" }},
      {{ "name": "具体的な単語やタイトル2", "note": "その詳しい説明や展開" }},
      {{ "name": "具体的な単語やタイトル3", "note": "その詳しい説明や展開" }}
    ]
    """

    # Ollamaを使ってローカルで推論（完全オフライン）
    response = ollama.chat(model='llama3', messages=[
        {'role': 'system', 'content': 'You output ONLY valid JSON arrays.'},
        {'role': 'user', 'content': prompt}
    ])
    
    answer = response['message']['content']
    print(f"AIの生出力:\n{answer}")

    # 強制的にJSON部分だけを切り抜くハック
    try:
        answer = answer.replace("```json", "").replace("```", "").strip()
        start = answer.find('[')
        end = answer.rfind(']')
        if start == -1 or end == -1:
            raise ValueError("JSON配列が見つかりません")
            
        json_str = answer[start:end+1]
        ideas = json.loads(json_str)
        return {"status": "success", "ideas": ideas}
    except Exception as e:
        print(f"エラー: {e}")
        return {"status": "error", "message": "思考が乱れました。もう一度試してください。"}

if __name__ == "__main__":
    import uvicorn
    # ポート8000でAIサーバーを起動
    uvicorn.run(app, host="127.0.0.1", port=8000)