"""
Debug Detalhado - Mostra exatamente o que o docxtpl está processando
"""

from docxtpl import DocxTemplate
import traceback

template_path = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"

print("="*80)
print("🔬 DEBUG DETALHADO - DOCXTPL")
print("="*80)

try:
    print("\n1️⃣ Carregando template...")
    doc = DocxTemplate(template_path)
    print("✅ Template carregado")
    
    print("\n2️⃣ Preparando contexto mínimo...")
    context = {
        'simulacao': [
            {'banco': 'Teste', 'parcelas': '12x', 'valor': 'R$ 100'}
        ],
        'fluxo': [
            {'ano': '1', 'tarifa': '0.95', 'gerada': '1000'}
        ]
    }
    print("✅ Contexto criado")
    
    print("\n3️⃣ Tentando renderizar...")
    doc.render(context)
    print("✅ Renderização bem-sucedida!")
    
    print("\n4️⃣ Salvando arquivo de teste...")
    doc.save("Teste_Debug.docx")
    print("✅ Arquivo salvo: Teste_Debug.docx")
    
except Exception as e:
    print(f"\n❌ ERRO: {e}")
    print("\n📋 Stack trace completo:")
    print("="*80)
    traceback.print_exc()
    print("="*80)
    
    # Tentar extrair mais informações
    if hasattr(e, 'lineno'):
        print(f"\n📍 Linha do erro: {e.lineno}")
    if hasattr(e, 'message'):
        print(f"💬 Mensagem: {e.message}")
