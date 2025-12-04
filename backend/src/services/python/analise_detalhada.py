"""
Script avançado para análise detalhada e correção manual guiada
"""
import zipfile
import re

TEMPLATE = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"

print("🔍 ANÁLISE DETALHADA DAS TAGS\n")
print("=" * 80)

with zipfile.ZipFile(TEMPLATE, 'r') as zip_ref:
    xml = zip_ref.read('word/document.xml').decode('utf-8')
    
    # Encontrar TODAS as tags que começam com {%
    todas_tags = re.findall(r'\{%[^}]*%\}', xml)
    
    print(f"📊 Total de tags encontradas: {len(todas_tags)}\n")
    
    # Categorizar tags
    tags_for = []
    tags_endfor = []
    tags_outras = []
    
    for tag in todas_tags:
        tag_limpo = re.sub(r'<[^>]+>', ' ', tag)  # Remover XML interno
        tag_limpo = re.sub(r'\s+', ' ', tag_limpo).strip()  # Normalizar espaços
        
        if ' for ' in tag_limpo.lower():
            tags_for.append((tag, tag_limpo))
        elif 'endfor' in tag_limpo.lower():
            tags_endfor.append((tag, tag_limpo))
        else:
            tags_outras.append((tag, tag_limpo))
    
    print(f"📌 TAGS DE ABERTURA DE LOOP ({len(tags_for)}):\n")
    for idx, (original, limpo) in enumerate(tags_for, 1):
        print(f"{idx}. {limpo}")
        if len(original) > len(limpo) + 20:
            print(f"   ⚠️  Tag quebrada (contém XML: {len(original)} chars)")
        
        # Identificar qual array está sendo iterado
        if 'simulacao' in limpo.lower():
            print(f"   ✅ Loop para: simulacao")
        elif 'fluxo' in limpo.lower():
            print(f"   ✅ Loop para: fluxo")
        elif ' f ' in limpo or limpo.endswith(' f %}'):
            print(f"   ❌ ERRO: Nome de variável incompleto ('f' ao invés de 'fluxo')")
        print()
    
    print("=" * 80)
    print(f"\n📌 TAGS DE FECHAMENTO DE LOOP ({len(tags_endfor)}):\n")
    for idx, (original, limpo) in enumerate(tags_endfor, 1):
        print(f"{idx}. {limpo}")
        if len(original) > len(limpo) + 20:
            print(f"   ⚠️  Tag quebrada (contém XML: {len(original)} chars)")
        print()
    
    if tags_outras:
        print("=" * 80)
        print(f"\n📌 OUTRAS TAGS ({len(tags_outras)}):\n")
        for idx, (original, limpo) in enumerate(tags_outras, 1):
            print(f"{idx}. {limpo}")
    
    print("\n" + "=" * 80)
    print("\n💡 DIAGNÓSTICO FINAL:\n")
    
    # Contar loops por tipo
    loops_simulacao = len([t for _, t in tags_for if 'simulacao' in t.lower()])
    loops_fluxo = len([t for _, t in tags_for if 'fluxo' in t.lower()])
    loops_f_incompleto = len([t for _, t in tags_for if ' f ' in t or t.endswith(' f %}')])
    
    print(f"  • Loops 'simulacao': {loops_simulacao}")
    print(f"  • Loops 'fluxo' (corretos): {loops_fluxo}")
    print(f"  • Loops 'f' (QUEBRADOS): {loops_f_incompleto}")
    print(f"  • Total aberturas: {len(tags_for)}")
    print(f"  • Total fechamentos: {len(tags_endfor)}")
    
    if len(tags_for) == len(tags_endfor):
        print(f"\n  ✅ Loops balanceados")
    else:
        print(f"\n  ❌ Loops DESBALANCEADOS!")
        print(f"     Diferença: {abs(len(tags_for) - len(tags_endfor))} tags")
        
        if len(tags_endfor) > len(tags_for):
            print(f"\n  ⚠️  PROBLEMA: Há {len(tags_endfor) - len(tags_for)} fechamentos a mais!")
            print(f"     SOLUÇÃO: Remova {len(tags_endfor) - len(tags_for)} tags {{%r endfor %}} excedentes")
    
    print("\n" + "=" * 80)
    print("\n📝 AÇÕES NECESSÁRIAS:\n")
    
    if loops_f_incompleto > 0:
        print(f"1. No Word, use Ctrl+H para:")
        print(f"   Buscar: {{%r for i in f %}}")
        print(f"   Substituir: {{%r for i in fluxo %}}")
        print(f"   (Isso corrigirá {loops_f_incompleto} loops quebrados)")
    
    if len(tags_endfor) > len(tags_for):
        print(f"\n2. Procure e REMOVA {len(tags_endfor) - len(tags_for)} tags {{%r endfor %}} duplicadas")
        print(f"   Provavelmente estão dentro das tabelas de simulacao ou fluxo")
    
    print(f"\n3. Estrutura correta de cada tabela:")
    print(f"   • Linha de cabeçalho (sem tags)")
    print(f"   • Linha de dados:")
    print(f"     - ANTES da primeira célula: {{%r for ... %}}")
    print(f"     - Dentro das células: {{{{ variavel }}}}")
    print(f"     - DEPOIS da última célula: {{%r endfor %}}")
    print(f"   • Apenas 1 abertura e 1 fechamento por tabela!")
