import random
def predict_mock(horizon: int):
    direction=random.choice(["UP","DOWN","SIDEWAYS"])
    return {"direction":direction,"probability":round(random.uniform(.52,.88),2),"confidence":random.choice(["low","medium","high"]),"model":"kronos","horizon":horizon,"forecast_close":0.0}
