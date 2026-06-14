import json
import google.generativeai as genai
from app.core.config import get_settings
from app.matching.catalog import ProductCatalog

settings = get_settings()
cat = ProductCatalog(settings.master_workbook_path, settings.products_path)
cat.load()

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel(settings.gemini_model)

catalog_json = json.dumps([{'id': p.id, 'name': p.name, 'pack': p.pack} for p in cat.products])

prompt = f'''You are a pharmaceutical catalog matcher. Map these raw order texts to the EXACT catalog ID from the provided catalog. 
Return ONLY a JSON array of objects with keys "text" and "catalogId". If no match is possible, set catalogId to null. 
Raw texts: ["Amlomvent at 3 bkc", "ventcortil 5", "chocolate powder", "american nuts"].

Catalog:
{catalog_json}'''

print(model.generate_content(prompt).text)
