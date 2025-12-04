"""
Busca por tags {% tr %} restantes no template
"""
import zipfile
import re

template_path = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"

with zipfile.ZipFile(template_path, 'r') as docx:
    with docx.open('word/document.xml') as xml_file:
        xml = xml_file.read().decode('utf-8')

# Buscar tags {% tr %}
tags_tr = re.findall(r'\{%\s*tr[^%]*%\}', xml, re.IGNORECASE)

print("="*80)
print("🔍 BUSCANDO TAGS {% tr %} NO TEMPLATE")
print("="*80)

if tags_tr:
    print(f"\n❌ Encontradas {len(tags_tr)} tags restantes que precisam ser corrigidas:\n")
    for i, tag in enumerate(tags_tr[:20], 1):  # Mostrar primeiras 20
        print(f"{i}. {tag}")
    
    if len(tags_tr) > 20:
        print(f"\n... e mais {len(tags_tr) - 20} tags")
    
    print("\n" + "="*80)
    print("💡 SOLUÇÃO:")
    print("="*80)
    print("No Word, use Ctrl+H (Buscar e Substituir):")
    print("\n1. Buscar: {% tr for")
    print("   Substituir: {% for")
    print("\n2. Buscar: {% tr endfor")
    print("   Substituir: {% endfor")
    print("\nSalve o arquivo e tente novamente!")
    print("="*80)
else:
    print("\n✅ Nenhuma tag {% tr %} encontrada!")
    print("   O template está usando sintaxe Jinja2 padrão corretamente.")
    print("="*80)
