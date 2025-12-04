"""
Script para corrigir automaticamente as tags quebradas no template
"""
import zipfile
import re
from pathlib import Path
import shutil

TEMPLATE_ORIGINAL = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
TEMPLATE_CORRIGIDO = r"C:\Users\roger\Downloads\Proposta 2025 - CORRIGIDO.docx"

print("🔧 CORREÇÃO AUTOMÁTICA DO TEMPLATE\n")
print("=" * 70)

# Fazer backup
shutil.copy2(TEMPLATE_ORIGINAL, TEMPLATE_CORRIGIDO)
print(f"✅ Backup criado: {Path(TEMPLATE_CORRIGIDO).name}\n")

# Abrir e corrigir
with zipfile.ZipFile(TEMPLATE_CORRIGIDO, 'r') as zip_ref:
    # Ler o XML
    xml_original = zip_ref.read('word/document.xml').decode('utf-8')

print("📊 ANTES DA CORREÇÃO:")
tags_tr = re.findall(r'\{%tr[^%]*%\}', xml_original, re.IGNORECASE)
print(f"  • Tags tr: {len(tags_tr)}")

tags_r_for = re.findall(r'\{%r[^%]*for[^%]*%\}', xml_original, re.IGNORECASE)
print(f"  • Tags r for: {len(tags_r_for)}")

# CORREÇÃO 1: Remover tags XML que quebram as tags Jinja2
# Padrão: {%r for i in f</w:t>...XML...</w:t>luxo %}
# Corrigir para: {%r for i in fluxo %}

xml_corrigido = xml_original

# Encontrar e corrigir tags quebradas
# Padrão de busca: {%r for i in f seguido de XML e depois luxo %}
padrao_quebrado = r'\{%r\s*for\s+i\s+in\s+f<[^>]+>[^<]*</[^>]+>[^<]*<[^>]+>luxo\s*%\}'
matches = re.finditer(padrao_quebrado, xml_corrigido)

count_corrigidos = 0
for match in matches:
    tag_quebrada = match.group(0)
    tag_corrigida = '{%r for i in fluxo %}'
    xml_corrigido = xml_corrigido.replace(tag_quebrada, tag_corrigida)
    count_corrigidos += 1
    print(f"\n✏️  Corrigindo tag quebrada {count_corrigidos}:")
    print(f"   Antes: {tag_quebrada[:80]}...")
    print(f"   Depois: {tag_corrigida}")

# CORREÇÃO 2: Substituir todas as variantes de tags tr por tags r
correções = [
    (r'\{%tr\s+for\s+', '{%r for '),
    (r'\{%tr\s+endfor\s*%\}', '{%r endfor %}'),
    (r'\{%\s+tr\s+for\s+', '{%r for '),
    (r'\{%\s+tr\s+endfor\s*%\}', '{%r endfor %}'),
]

print(f"\n📝 APLICANDO SUBSTITUIÇÕES:")
for padrao, substituto in correções:
    matches = re.findall(padrao, xml_corrigido, re.IGNORECASE)
    if matches:
        xml_corrigido = re.sub(padrao, substituto, xml_corrigido, flags=re.IGNORECASE)
        print(f"  • '{padrao}' → '{substituto}' ({len(matches)} ocorrências)")

# Salvar o arquivo corrigido
with zipfile.ZipFile(TEMPLATE_CORRIGIDO, 'w', zipfile.ZIP_DEFLATED) as zip_out:
    # Copiar todos os arquivos exceto document.xml
    with zipfile.ZipFile(TEMPLATE_ORIGINAL, 'r') as zip_in:
        for item in zip_in.infolist():
            if item.filename != 'word/document.xml':
                zip_out.writestr(item, zip_in.read(item.filename))
    
    # Adicionar o document.xml corrigido
    zip_out.writestr('word/document.xml', xml_corrigido.encode('utf-8'))

print("\n" + "=" * 70)
print("📊 DEPOIS DA CORREÇÃO:")

# Verificar resultado
with zipfile.ZipFile(TEMPLATE_CORRIGIDO, 'r') as zip_ref:
    xml_final = zip_ref.read('word/document.xml').decode('utf-8')
    
    tags_tr = re.findall(r'\{%tr[^%]*%\}', xml_final, re.IGNORECASE)
    tags_r_for = re.findall(r'\{%r\s*for\s+i\s+in\s+fluxo\s*%\}', xml_final, re.IGNORECASE)
    tags_r_endfor = re.findall(r'\{%r\s*endfor\s*%\}', xml_final, re.IGNORECASE)
    
    print(f"  • Tags tr: {len(tags_tr)} {'✅ (removidas)' if len(tags_tr) == 0 else '⚠️  (ainda existem)'}")
    print(f"  • Tags r for i in fluxo: {len(tags_r_for)}")
    print(f"  • Tags r endfor: {len(tags_r_endfor)}")
    
    if len(tags_r_for) > 0 and len(tags_r_for) == len(tags_r_endfor):
        print(f"\n✅ Loops balanceados! {len(tags_r_for)} loops completos")
    elif len(tags_r_for) != len(tags_r_endfor):
        print(f"\n⚠️  Loops desbalanceados: {len(tags_r_for)} aberturas vs {len(tags_r_endfor)} fechamentos")

print("\n" + "=" * 70)
print(f"\n✅ Template corrigido salvo em:")
print(f"   {TEMPLATE_CORRIGIDO}")
print("\n💡 Use este template corrigido no código Python!")
