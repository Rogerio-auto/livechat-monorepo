"""
Script para verificar a estrutura das tags de loop no template
"""
import zipfile
import re

TEMPLATE = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"

print("🔍 VERIFICANDO ESTRUTURA DAS TAGS DE LOOP\n")
print("=" * 70)

with zipfile.ZipFile(TEMPLATE, 'r') as zip_ref:
    xml = zip_ref.read('word/document.xml').decode('utf-8')
    
    # Buscar tags {%r for
    tags_r_for = re.findall(r'\{%r[^%]*for[^%]*%\}', xml, re.IGNORECASE)
    tags_r_endfor = re.findall(r'\{%r[^%]*endfor[^%]*%\}', xml, re.IGNORECASE)
    
    print(f"📊 Tags de abertura de loop ({len(tags_r_for)}):")
    for idx, tag in enumerate(tags_r_for, 1):
        # Limpar XML interno se houver
        tag_limpo = re.sub(r'<[^>]+>', '', tag)
        print(f"  {idx}. {tag_limpo}")
        if '<' in tag:
            print(f"     ⚠️  ATENÇÃO: Tag quebrada pelo Word!")
    
    print(f"\n📊 Tags de fechamento de loop ({len(tags_r_endfor)}):")
    for idx, tag in enumerate(tags_r_endfor, 1):
        tag_limpo = re.sub(r'<[^>]+>', '', tag)
        print(f"  {idx}. {tag_limpo}")
        if '<' in tag:
            print(f"     ⚠️  ATENÇÃO: Tag quebrada pelo Word!")
    
    # Buscar contexto da tabela de fluxo
    print("\n" + "=" * 70)
    print("🔍 PROCURANDO TABELA DE FLUXO (com 'i.ano', 'i.tarifa', etc):\n")
    
    # Buscar referências a variáveis do fluxo
    vars_fluxo = re.findall(r'\{\{\s*i\.[a-z_]+\s*\}\}', xml, re.IGNORECASE)
    
    if vars_fluxo:
        vars_unicas = sorted(set([re.sub(r'<[^>]+>', '', v) for v in vars_fluxo]))
        print(f"✅ Encontradas {len(vars_unicas)} variáveis do fluxo:")
        for var in vars_unicas:
            print(f"  • {var}")
        
        # Verificar se há tags de loop para essas variáveis
        if tags_r_for:
            has_fluxo_loop = any('fluxo' in tag.lower() for tag in tags_r_for)
            if has_fluxo_loop:
                print("\n✅ Encontrado loop para 'fluxo'")
            else:
                print("\n❌ NÃO encontrado loop para 'fluxo'!")
                print("   As variáveis {{ i.ano }} existem mas não há {%r for i in fluxo %}")
    else:
        print("❌ Não encontradas variáveis do fluxo ({{ i.* }})")
    
    # Verificar loop de simulacao
    print("\n" + "=" * 70)
    print("🔍 PROCURANDO TABELA DE SIMULAÇÃO:\n")
    
    vars_simulacao = re.findall(r'\{\{\s*item\.[a-z_]+\s*\}\}', xml, re.IGNORECASE)
    
    if vars_simulacao:
        vars_unicas = sorted(set([re.sub(r'<[^>]+>', '', v) for v in vars_simulacao]))
        print(f"✅ Encontradas {len(vars_unicas)} variáveis da simulação:")
        for var in vars_unicas:
            print(f"  • {var}")
        
        if tags_r_for:
            has_simulacao_loop = any('simulacao' in tag.lower() for tag in tags_r_for)
            if has_simulacao_loop:
                print("\n✅ Encontrado loop para 'simulacao'")
            else:
                print("\n❌ NÃO encontrado loop para 'simulacao'!")
    else:
        print("❌ Não encontradas variáveis da simulação ({{ item.* }})")
    
    print("\n" + "=" * 70)
    print("\n💡 DIAGNÓSTICO:")
    
    if len(tags_r_for) != len(tags_r_endfor):
        print(f"❌ Loops desbalanceados: {len(tags_r_for)} aberturas vs {len(tags_r_endfor)} fechamentos")
    
    if any('<' in tag for tag in tags_r_for + tags_r_endfor):
        print("⚠️  Algumas tags estão quebradas pelo Word (contêm XML interno)")
        print("   SOLUÇÃO: Apague e digite novamente no Word")
    
    if not tags_r_for:
        print("❌ NENHUMA tag {%r for %} encontrada!")
        print("   Verifique se você realmente substituiu {% tr for por {%r for")
