import api from "./client";

/** @typedef {{_id:string,symbol:string,horizon:number,direction:"UP"|"DOWN"|"SIDEWAYS",probability:number,confidence:string,status:"pending"|"resolved",made_at:string,correct?:boolean,entry_price:number,forecast_close:number}} Prediction */

/** @param {{symbol?:string,horizon?:number,status?:string,limit?:number}} [filters] @returns {Promise<Prediction[]>} */
export async function getPredictions(filters = {}) { return (await api.get("/predictions", { params: filters })).data; }

/** @returns {Promise<Record<string,{count:number,accuracy:number,baseline_accuracy:number,beats_baseline:boolean}>>} */
export async function getPredictionStats() { return (await api.get("/predictions/stats")).data; }

/** @param {{symbol:string,horizon:5|10|30}} request */
export async function createPrediction(request) { return (await api.post("/predictions", request)).data; }
