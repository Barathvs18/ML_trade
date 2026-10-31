import random
def predict_mock(horizon: int):
    direction=random.choice(["UP","DOWN","SIDEWAYS"])
    probability=round(random.uniform(.52,.88),2)
    remaining=(1-probability)/2
    probabilities={key:round(remaining,4) for key in ("UP","DOWN","SIDEWAYS")}
    probabilities[direction]=round(1-2*remaining,4)
    return {"direction":direction,"probability":probability,"probabilities":probabilities,"confidence":random.choice(["low","medium","high"]),"model":"kronos","horizon":horizon,"forecast_close":0.0}
