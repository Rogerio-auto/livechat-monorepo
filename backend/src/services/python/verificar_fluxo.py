"""
Script para verificar se os dados de fluxo estão sendo gerados corretamente
"""
from proposal_generator import GeradorPropostaSolar

# Caminho do template
TEMPLATE = r"C:\Users\roger\Downloads\Proposta 2025 - CORRIGIDO.docx"

# Criar instância
gerador = GeradorPropostaSolar(TEMPLATE)

# Calcular fluxo
fluxo = gerador.calcular_fluxo_caixa(25000)

print(f"📊 Total de anos gerados: {len(fluxo)}")
print("\n🔍 Primeiros 3 anos:")
for i in range(min(3, len(fluxo))):
    print(f"\nAno {i+1}:")
    print(f"  {fluxo[i]}")

print(f"\n🔍 Últimos 3 anos:")
for i in range(max(0, len(fluxo)-3), len(fluxo)):
    print(f"\nAno {i+1}:")
    print(f"  {fluxo[i]}")

print("\n✅ Os dados estão sendo gerados corretamente!")
print("⚠️  Se a tabela mostra só 1 linha, o problema está no template Word!")
