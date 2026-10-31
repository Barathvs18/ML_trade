"""End-to-end Compose smoke check. Requires a running local Compose stack."""
import asyncio
import os
from pathlib import Path
import sys
import time
from datetime import datetime, timezone

import httpx
import pymongo
import websockets

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
for line in (ROOT/".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        key,value=line.split("=",1);os.environ.setdefault(key.strip(),value.strip())
os.environ.setdefault("FEED_MODE","replay");os.environ.setdefault("ML_MOCK","true")

from app.config import settings
from app.core.security import create_access_token

BASE=os.getenv("SMOKE_BASE_URL","http://127.0.0.1:8000")
USER_ID="compose-smoke-user"

def seed_test_user():
    uri=os.getenv("MONGO_URI","mongodb://localhost:27017/?replicaSet=rs0").replace("mongo:27017",f"localhost:{os.getenv('SMOKE_MONGO_PORT','27018')}")
    uri += "&directConnection=true" if "?" in uri else "?directConnection=true"
    mongo=pymongo.MongoClient(uri,serverSelectionTimeoutMS=5000)
    db=mongo[settings.db_name]
    db.users.update_one({"user_id":USER_ID},{"$set":{"user_id":USER_ID,"google_id":USER_ID,"email":"smoke@example.invalid","name":"Smoke Test"}},upsert=True)
    db.wallets.update_one({"user_id":USER_ID},{"$setOnInsert":{"user_id":USER_ID,"balance":settings.starting_balance,"blocked_margin":0,"realized_pnl":0,"version":0,"created_at":datetime.now(timezone.utc)}},upsert=True)
    mongo.close()

async def main():
    seed_test_user();token=create_access_token(USER_ID);headers={"Authorization":f"Bearer {token}"}
    lines=[]
    async with httpx.AsyncClient(base_url=BASE,timeout=30,headers=headers,cookies={"access_token":token}) as client:
        for attempt in range(60):
            try:
                response=await client.get("/health")
                if response.status_code==200:break
            except httpx.HTTPError:pass
            await asyncio.sleep(1)
        response.raise_for_status();health=response.json();lines.append(f"GET /health -> {response.status_code} {health}")
        status=await client.get("/market/status");lines.append(f"GET /market/status -> {status.status_code}");status.raise_for_status()
        stocks=await client.get("/market/stocks");stocks.raise_for_status();lines.append(f"GET /market/stocks -> {stocks.status_code} ({len(stocks.json())} stocks)")
        symbol="RELIANCE"
        candles=await client.get(f"/market/candles/{symbol}",params={"interval":"5m","limit":20});candles.raise_for_status();lines.append(f"GET /market/candles -> {candles.status_code} ({len(candles.json())} bars)")
        prediction=await client.post("/predictions",json={"symbol":symbol,"horizon":5});prediction.raise_for_status();lines.append(f"POST /predictions -> {prediction.status_code}")
        stats=await client.get("/predictions/stats");stats.raise_for_status();lines.append(f"GET /predictions/stats -> {stats.status_code}")
        order=await client.post("/paper/orders",json={"symbol":symbol,"side":"BUY","qty":1});order.raise_for_status();lines.append(f"POST /paper/orders BUY -> {order.status_code}")
        close=await client.post(f"/paper/positions/{symbol}/close");close.raise_for_status();lines.append(f"POST /paper/positions close -> {close.status_code}")
        positions=await client.get("/paper/positions");positions.raise_for_status();lines.append(f"GET /paper/positions -> {positions.status_code}")
        pnl=await client.get("/paper/pnl");pnl.raise_for_status();lines.append(f"GET /paper/pnl -> {pnl.status_code}")
        dashboard=await client.get("/dashboard/summary");dashboard.raise_for_status();lines.append(f"GET /dashboard/summary -> {dashboard.status_code}")
    async with websockets.connect(BASE.replace("http://","ws://")+"/ws/prices",additional_headers={"Cookie":f"access_token={token}"}) as socket:
        await socket.send('{"subscribe":["RELIANCE"]}')
        tick=await asyncio.wait_for(socket.recv(),timeout=10)
        lines.append(f"WS /ws/prices -> tick {tick[:200]}")
    output="\n".join(lines)+"\n"
    target=ROOT/"backend"/"reports"/"smoke_test_output.txt";target.parent.mkdir(parents=True,exist_ok=True);target.write_text(output,encoding="utf-8")
    print(output,end="")

if __name__=="__main__":asyncio.run(main())
