from bson import ObjectId

def api_value(value):
    if isinstance(value,ObjectId):return str(value)
    if isinstance(value,dict):return {key:api_value(item) for key,item in value.items()}
    if isinstance(value,(list,tuple)):return [api_value(item) for item in value]
    return value
