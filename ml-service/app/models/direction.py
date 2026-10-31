from app.config import settings

def direction_for_return(expected_return_pct:float,threshold_pct:float|None=None)->str:
    threshold=settings.sideways_threshold_pct if threshold_pct is None else threshold_pct
    if abs(expected_return_pct)<threshold:return "SIDEWAYS"
    return "UP" if expected_return_pct>0 else "DOWN"

def expected_return_pct(forecast_close:float,last_close:float)->float:
    if last_close<=0:raise ValueError("last_close must be positive")
    return (forecast_close-last_close)/last_close*100

def summarize_forecasts(forecast_closes:list[float],last_close:float,threshold_pct:float|None=None)->dict:
    if not forecast_closes:raise ValueError("at least one forecast path is required")
    probabilities={"UP":0.0,"DOWN":0.0,"SIDEWAYS":0.0}
    for forecast_close in forecast_closes:
        probabilities[direction_for_return(expected_return_pct(forecast_close,last_close),threshold_pct)]+=1.0
    probabilities={name:share/len(forecast_closes) for name,share in probabilities.items()}
    top_share=max(probabilities.values())
    top_classes=[name for name,share in probabilities.items() if share==top_share]
    # A tie among the leading classes resolves to SIDEWAYS as specified by the API.
    direction=top_classes[0] if len(top_classes)==1 else "SIDEWAYS"
    probability=top_share
    mean_close=sum(forecast_closes)/len(forecast_closes)
    confidence="low" if probability<settings.confidence_low else "medium" if probability<=settings.confidence_high else "high"
    return {"direction":direction,"probability":probability,"probabilities":probabilities,"confidence":confidence,"forecast_close":float(mean_close)}
