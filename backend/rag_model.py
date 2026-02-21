import os
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from pinecone import Pinecone, ServerlessSpec
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Récupérer les clés API
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV", "gcp-starter")  # valeur par défaut si non définie

print(f"🔑 Clé API Pinecone chargée: {'Oui' if PINECONE_API_KEY else 'Non'}")
print(f"🌍 Environnement Pinecone: {PINECONE_ENV}")

# -------------------------
# Initialize Pinecone
# -------------------------
pc = Pinecone(api_key=PINECONE_API_KEY)

index_name = "lab-rag-index"

# Vérifier si l'index existe, sinon le créer
if index_name not in pc.list_indexes().names():
    print(f"Création de l'index {index_name}...")
    pc.create_index(
        name=index_name,
        dimension=384,  # Dimension pour "thenlper/gte-small" est 384
        metric="cosine",
        spec=ServerlessSpec(
            cloud="aws",
            region="eu-west-1"  # Changez selon votre région
        )
    )
else:
    print(f"✅ Index {index_name} existe déjà")

# Use SAME embedding model you used in notebook
embedding_model = HuggingFaceEmbeddings(
    model_name="thenlper/gte-small"
)

# Connexion à l'index existant
index = pc.Index(index_name)

# Créer le vectorstore avec LangChain
vectorstore = PineconeVectorStore(
    index=index,
    embedding=embedding_model,
    text_key="text",
    namespace="ns1"
)

print("✅ Connexion à Pinecone réussie!")

# -------------------------
# Load YOUR LLM
# -------------------------
model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

print(f"📦 Chargement du modèle {model_name}...")
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float32,
    low_cpu_mem_usage=True,
    device_map="auto"
)
model.eval()
# Ajouter un token de padding si nécessaire
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

print("✅ Modèle chargé avec succès!")

# -------------------------
# Your RAG Pipeline
# -------------------------
def RAG_Solution(query: str):
    try:
        # Gestion des salutations plus robuste
        clean_query = query.lower().strip()
        greetings = ["hi", "hello", "bonjour", "salut", "hey", "bonsoir", "hii", "helo"]
        
        if any(clean_query == g or clean_query.startswith(g + " ") for g in greetings) and len(clean_query) < 15:
            return "Hello! I am your Medical AI Assistant. How can I help you today?"
    
        print(f"🔍 Recherche pour: {query}")
        
        # 1️⃣ Retrieve
        docs = vectorstore.similarity_search(query, k=3)
        context = "\n".join([doc.page_content for doc in docs])
        
        print(f"📚 Contexte trouvé: {len(docs)} documents")

        # 2️⃣ Prompt
        prompt = f"""You are a helpful medical AI assistant.
Answer with the context you are provided . If the answer cannot be found in the context, say "I cannot find this information in the provided context , if the user greets you or asks you greeting questions answer thelm with a greeting and if the user asks you to introduce yourself answer them with a short introduction of yourself. Answer with the language the user asks you with
Do NOT answer questions that are not related to the medical field, if the user asks you a question that is not related to the medical field answer them with "I am sorry but I can only answer questions related to the medical field
ALWAYS add you should consider consulting a healthcare professional for personalized advice and treatment options at the end of your answer"

Context:
{context}

Question:
{query}

Answer:"""

        # 3️⃣ Generate
        inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)
        device = next(model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}


        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=300,
                temperature=0.2,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )

        # 4️⃣ Decode
        full_response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        answer = full_response.split("Answer:")[-1].strip()

        print(f"✅ Réponse générée")
        return answer
    
    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        return f"Erreur dans le pipeline RAG: {str(e)}"
