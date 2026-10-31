from dataclasses import dataclass
import math

@dataclass
class KronosModel:
    predictor:object|None=None
    tokenizer:object|None=None
    mock:bool=True
    available:bool=True

    @classmethod
    def load(cls):return cls()

    def forecast_paths(self,candles:list[dict],pred_len:int,samples:int)->list[float]:
        last=float(candles[-1]["c"])
        if self.mock:
            recent=[float(c["c"]) for c in candles[-6:]]
            momentum=(recent[-1]-recent[0])/max(1,len(recent)-1)
            scale=max(last*.00015,abs(momentum)*.35)
            return [last+momentum*pred_len+scale*math.sin(i*1.7) for i in range(samples)]
        raise RuntimeError("Kronos implementation is not loaded")
