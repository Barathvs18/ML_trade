export const MOCK_STOCKS = [
  ["ADANIENT", "Adani Enterprises"], ["ADANIPORTS", "Adani Ports and Special Economic Zone"], ["APOLLOHOSP", "Apollo Hospitals Enterprise"],
  ["ASIANPAINT", "Asian Paints"], ["AXISBANK", "Axis Bank"], ["BAJAJ-AUTO", "Bajaj Auto"], ["BAJAJFINSV", "Bajaj Finserv"], ["BAJFINANCE", "Bajaj Finance"],
  ["BEL", "Bharat Electronics"], ["BHARTIARTL", "Bharti Airtel"], ["CIPLA", "Cipla"], ["COALINDIA", "Coal India"], ["DRREDDY", "Dr. Reddy's Laboratories"],
  ["EICHERMOT", "Eicher Motors"], ["GRASIM", "Grasim Industries"], ["HCLTECH", "HCL Technologies"], ["HDFCBANK", "HDFC Bank"], ["HDFCLIFE", "HDFC Life Insurance"],
  ["HEROMOTOCO", "Hero MotoCorp"], ["HINDALCO", "Hindalco Industries"], ["HINDUNILVR", "Hindustan Unilever"], ["ICICIBANK", "ICICI Bank"], ["INDUSINDBK", "IndusInd Bank"],
  ["INFY", "Infosys"], ["ITC", "ITC"], ["JIOFIN", "Jio Financial Services"], ["JSWSTEEL", "JSW Steel"], ["KOTAKBANK", "Kotak Mahindra Bank"],
  ["LT", "Larsen & Toubro"], ["LTIM", "LTIMindtree"], ["M&M", "Mahindra & Mahindra"], ["MARUTI", "Maruti Suzuki India"], ["NESTLEIND", "Nestle India"],
  ["NTPC", "NTPC"], ["ONGC", "Oil and Natural Gas Corporation"], ["POWERGRID", "Power Grid Corporation of India"], ["RELIANCE", "Reliance Industries"],
  ["SBILIFE", "SBI Life Insurance"], ["SBIN", "State Bank of India"], ["SHRIRAMFIN", "Shriram Finance"], ["SUNPHARMA", "Sun Pharmaceutical Industries"],
  ["TATACONSUM", "Tata Consumer Products"], ["TATAMOTORS", "Tata Motors"], ["TATASTEEL", "Tata Steel"], ["TCS", "Tata Consultancy Services"], ["TECHM", "Tech Mahindra"],
  ["TITAN", "Titan Company"], ["TRENT", "Trent"], ["ULTRACEMCO", "UltraTech Cement"], ["WIPRO", "Wipro"],
].map(([symbol, name]) => ({ symbol, name, instrument_key: `MOCK|NSE_EQ|${symbol}` }));
