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
    mean_close=sum(forecast_closes)/len(forecast_closes)
    direction=direction_for_return(expected_return_pct(mean_close,last_close),threshold_pct)
    if len(forecast_closes)==1:
        # One-path model fallback: report neutral probability; it is not calibrated confidence.
        probability=0.5
    else:
        agrees=sum(direction_for_return(expected_return_pct(value,last_close),threshold_pct)==direction for value in forecast_closes)
        probability=agrees/len(forecast_closes)
    confidence="low" if probability<settings.confidence_low else "medium" if probability<=settings.confidence_high else "high"
    return {"direction":direction,"probability":probability,"confidence":confidence,"forecast_close":float(mean_close)}
