from dataclasses import dataclass

@dataclass
class LPatchTSTModel:
    model:object|None=None
    mock:bool=True
    available:bool=True

    @classmethod
    def load(cls):return cls()

    def forecast_close(self,candles:list[dict])->float:
        last=float(candles[-1]["c"])
        if self.mock:
            recent=[float(c["c"]) for c in candles[-5:]]
            return last+(recent[-1]-recent[0])/max(1,len(recent)-1)
        raise RuntimeError("LPatchTST implementation is not loaded")
