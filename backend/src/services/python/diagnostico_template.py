"""
Script de Diagnóstico - Encontra erros de sintaxe Jinja2 no template
"""

import zipfile
import re
from pathlib import Path

def diagnosticar_template(template_path):
    """Analisa o template e identifica problemas de sintaxe"""
    
    print("="*80)
    print("🔍 DIAGNÓSTICO DE SINTAXE JINJA2")
    print("="*80)
    print(f"📄 Arquivo: {Path(template_path).name}\n")
    
    # Extrair XML
    with zipfile.ZipFile(template_path, 'r') as docx:
        with docx.open('word/document.xml') as xml_file:
            xml_content = xml_file.read().decode('utf-8')
    
    # Limpar tags do Word
    clean = re.sub(r'<w:t[^>]*>', '', xml_content)
    clean = re.sub(r'</w:t>', '', clean)
    clean = re.sub(r'<w:r[^>]*>', '', clean)
    clean = re.sub(r'</w:r>', '', clean)
    
    print("1️⃣ Procurando por {{ }} com espaços incorretos...")
    print("-" * 80)
    
    # Padrão: {{ palavra espaço palavra }} (ERRADO)
    erros_espaco = re.finditer(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)', clean)
    
    erros_encontrados = []
    for match in erros_espaco:
        erro = {
            'tipo': 'Espaço em vez de ponto',
            'texto': match.group(0),
            'var1': match.group(1),
            'var2': match.group(2),
            'posicao': match.start(),
            'correcao': f'{{{{ {match.group(1)}.{match.group(2)} }}}}'
        }
        erros_encontrados.append(erro)
    
    if erros_encontrados:
        print(f"❌ Encontrados {len(erros_encontrados)} erros:\n")
        for i, erro in enumerate(erros_encontrados, 1):
            print(f"Erro {i}:")
            print(f"  📍 Posição: {erro['posicao']}")
            print(f"  ❌ Encontrado: {erro['texto']}")
            print(f"  ✅ Deveria ser: {erro['correcao']}")
            print(f"  💡 Explicação: '{erro['var1']}' e '{erro['var2']}' devem estar unidos por ponto (.)")
            print()
    else:
        print("✅ Nenhum erro de espaçamento encontrado\n")
    
    print("2️⃣ Procurando por tags {% %} com problemas...")
    print("-" * 80)
    
    # Encontrar todos os blocos {% %}
    tags = re.finditer(r'\{%\s*(.+?)\s*%\}', clean)
    
    tags_invalidas = []
    for match in tags:
        conteudo = match.group(1).strip()
        
        # Verificar se é um for válido
        if conteudo.startswith('for '):
            if ' in ' not in conteudo:
                tags_invalidas.append({
                    'texto': match.group(0),
                    'problema': 'Falta "in" no loop for',
                    'posicao': match.start()
                })
        
        # Verificar if
        elif conteudo.startswith('if '):
            if conteudo.count('if') > 1:
                tags_invalidas.append({
                    'texto': match.group(0),
                    'problema': 'Múltiplos "if" na mesma tag',
                    'posicao': match.start()
                })
    
    if tags_invalidas:
        print(f"❌ Encontradas {len(tags_invalidas)} tags inválidas:\n")
        for i, tag in enumerate(tags_invalidas, 1):
            print(f"Tag {i}:")
            print(f"  📍 Posição: {tag['posicao']}")
            print(f"  ❌ Encontrado: {tag['texto']}")
            print(f"  ⚠️  Problema: {tag['problema']}")
            print()
    else:
        print("✅ Todas as tags {% %} parecem válidas\n")
    
    print("3️⃣ Análise de linha aproximada do erro...")
    print("-" * 80)
    
    # Contar linhas até o erro
    # O erro está na linha 270 do template processado
    linhas = clean.split('\n')
    
    if len(linhas) >= 270:
        print(f"Linha ~270 do template processado:")
        print(f"  {linhas[269][:200]}...")
        print()
    
    # Procurar especificamente por "ano" com problemas
    print("4️⃣ Procurando especificamente por 'ano' malformado...")
    print("-" * 80)
    
    problemas_ano = re.finditer(r'\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s+ano\s*\}\}', clean)
    
    count = 0
    for match in problemas_ano:
        count += 1
        print(f"❌ Encontrado: {match.group(0)}")
        print(f"   Posição: {match.start()}")
        
        # Extrair o nome da variável
        var_name = match.group(0).replace('{{', '').replace('}}', '').strip().split()[0]
        print(f"   ✅ Deveria ser: {{{{ {var_name}.ano }}}}")
        print()
    
    if count == 0:
        print("✅ Nenhum problema específico com 'ano' encontrado\n")
    
    print("="*80)
    print("📊 RESUMO")
    print("="*80)
    print(f"Total de problemas encontrados: {len(erros_encontrados) + len(tags_invalidas) + count}")
    print()
    
    if erros_encontrados or tags_invalidas or count > 0:
        print("💡 AÇÃO NECESSÁRIA:")
        print("   Abra o template no Word e corrija os erros listados acima")
        print("   Use Ctrl+F para buscar os textos exatos mostrados")
        print()
    else:
        print("✅ Nenhum problema óbvio detectado")
        print("   O erro pode estar em uma tag que o Word dividiu internamente")
        print()

if __name__ == "__main__":
    template = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    diagnosticar_template(template)
