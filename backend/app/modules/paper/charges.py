# Approximate Indian intraday equity charges; verify rates before relying on them.
def calculate_charges(turnover: float, side: str) -> dict:
    brokerage=min(20.0,turnover*0.0003)
    stt=turnover*0.00025 if side.upper()=="SELL" else 0.0
    transaction=turnover*0.0000325
    gst=(brokerage+transaction)*0.18
    sebi=turnover*0.000001
    stamp=turnover*0.00003 if side.upper()=="BUY" else 0.0
    return {"brokerage":brokerage,"stt":stt,"exchange":transaction,"gst":gst,"sebi":sebi,"stamp_duty":stamp,"total":brokerage+stt+transaction+gst+sebi+stamp}
