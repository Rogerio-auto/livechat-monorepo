"""
Extrator de Linha Específica - Mostra a linha 270 do XML processado
"""

import zipfile
import re

template_path = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"

print("="*80)
print("🔍 EXTRAINDO LINHA 270 DO TEMPLATE")
print("="*80)

# Extrair e processar XML
with zipfile.ZipFile(template_path, 'r') as docx:
    with docx.open('word/document.xml') as xml_file:
        xml_raw = xml_file.read().decode('utf-8')

# O docxtpl processa o XML de forma especial
# Vamos simular o que ele faz
print("\n1️⃣ Extraindo linhas do XML...")

# Dividir em linhas
linhas = xml_raw.split('\n')
print(f"   Total de linhas no XML: {len(linhas)}")

if len(linhas) >= 270:
    print(f"\n2️⃣ LINHA 270 (raw):")
    print("-" * 80)
    print(linhas[269])  # índice 269 = linha 270
    print("-" * 80)
    
    # Procurar por 'ano' nessa linha
    if 'ano' in linhas[269]:
        print("\n✅ Palavra 'ano' encontrada na linha 270!")
        
        # Extrair contexto
        inicio = max(0, linhas[269].find('ano') - 100)
        fim = min(len(linhas[269]), linhas[269].find('ano') + 100)
        contexto = linhas[269][inicio:fim]
        
        print("\n📍 Contexto ao redor de 'ano':")
        print("-" * 80)
        print(contexto)
        print("-" * 80)

# Procurar padrões problemáticos em todo o documento
print("\n3️⃣ Procurando padrões {{ item ano }} (sem ponto)...")
print("-" * 80)

# Padrão problemático: {{ item ano }} ou {{ fluxo ano }}
padrao_errado = re.finditer(r'\{\{\s*([a-zA-Z_]+)\s+(ano)\s*\}\}', xml_raw)

encontrados = list(padrao_errado)
if encontrados:
    print(f"❌ Encontrados {len(encontrados)} problemas:")
    for i, match in enumerate(encontrados[:5], 1):  # Mostrar apenas os 5 primeiros
        print(f"\n  Problema {i}:")
        print(f"    Texto: {match.group(0)}")
        print(f"    Deveria ser: {{{{ {match.group(1)}.{match.group(2)} }}}}")
        
        # Encontrar em qual linha está
        pos = match.start()
        linha_num = xml_raw[:pos].count('\n') + 1
        print(f"    Linha aproximada: {linha_num}")
else:
    print("✅ Nenhum padrão {{ item ano }} encontrado")

# Procurar outros padrões com 'ano'
print("\n4️⃣ Procurando TODAS as ocorrências de 'ano' em tags Jinja2...")
print("-" * 80)

ano_tags = re.finditer(r'\{\{[^}]*ano[^}]*\}\}', xml_raw)
count = 0
for match in list(ano_tags)[:10]:  # Mostrar primeiras 10
    count += 1
    print(f"  {count}. {match.group(0)}")

print(f"\n   Total de tags com 'ano': {count}")

print("\n" + "="*80)
print("💡 DICA:")
print("   Se você vir algo como {{ item ano }} ou {{ fluxo ano }}")
print("   Deve ser corrigido para {{ item.ano }} ou {{ fluxo.ano }}")
print("="*80)
