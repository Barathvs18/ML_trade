import api from "./client";

/** @typedef {{_id:string,symbol:string,horizon:number,direction:"UP"|"DOWN"|"SIDEWAYS",probability:number,probabilities?:{UP:number,DOWN:number,SIDEWAYS:number},confidence:string,status:"pending"|"resolved",made_at:string,correct?:boolean,actual_direction?:"UP"|"DOWN"|"SIDEWAYS",actual_return_pct?:number,resolve_at:string,entry_price:number,forecast_close:number}} Prediction */

/** @param {{symbol?:string,horizon?:number,status?:string,limit?:number}} [filters] @returns {Promise<Prediction[]>} */
export async function getPredictions(filters = {}) { return (await api.get("/predictions", { params: filters })).data; }

/** @param {string} predictionId @returns {Promise<Prediction>} */
export async function getPrediction(predictionId) { return (await api.get(`/predictions/${encodeURIComponent(predictionId)}`)).data; }

/** @returns {Promise<Record<string,{count:number,accuracy:number,baseline_accuracy:number,beats_baseline:boolean}>>} */
export async function getPredictionStats() { return (await api.get("/predictions/stats")).data; }

/** @param {{symbol:string,horizon:5|10|30}} request */
export async function createPrediction(request) { return (await api.post("/predictions", request)).data; }
