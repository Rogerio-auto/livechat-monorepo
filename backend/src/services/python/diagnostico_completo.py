"""
Script de diagnóstico completo para encontrar TODOS os problemas de sintaxe em templates DOCX
"""
import zipfile
import re
from pathlib import Path

# Caminho do template
TEMPLATE = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"

print("🔍 DIAGNÓSTICO COMPLETO DO TEMPLATE\n")
print("=" * 70)

try:
    with zipfile.ZipFile(TEMPLATE, 'r') as zip_ref:
        # Ler o XML principal
        xml = zip_ref.read('word/document.xml').decode('utf-8')
        
        print(f"📄 Template: {TEMPLATE}")
        print(f"📏 Tamanho do XML: {len(xml):,} caracteres\n")
        
        # 1. Buscar todas as tags Jinja2
        todas_tags = re.findall(r'\{%[^%]*%\}', xml)
        print(f"📊 Total de tags Jinja2 encontradas: {len(todas_tags)}\n")
        
        # 2. Buscar tags problemáticas
        problemas = []
        
        # 2.1 Tags com 'tr' (obsoletas)
        tags_tr = re.findall(r'\{%\s*tr[^%]*%\}', xml, re.IGNORECASE)
        if tags_tr:
            problemas.append(("Tags {% tr %} obsoletas", tags_tr))
        
        # 2.2 Tags com espaço após %
        tags_espaco_errado = re.findall(r'\{%\s+[a-z]\s+[^%]*%\}', xml, re.IGNORECASE)
        if tags_espaco_errado:
            problemas.append(("Tags com espaço incorreto ({% r endfor %} ao invés de {%r endfor %})", tags_espaco_errado))
        
        # 2.3 Tags malformadas
        tags_malformadas = re.findall(r'\{%[^%]{0,5}%\}', xml)  # Tags muito curtas
        if tags_malformadas:
            problemas.append(("Tags possivelmente malformadas (muito curtas)", tags_malformadas))
        
        # 2.4 Tags 'endfor' soltas
        tags_endfor = re.findall(r'\{%\s*endfor\s*%\}', xml, re.IGNORECASE)
        tags_r_endfor = re.findall(r'\{%r\s*endfor\s*%\}', xml, re.IGNORECASE)
        tags_p_endfor = re.findall(r'\{%p\s*endfor\s*%\}', xml, re.IGNORECASE)
        
        endfor_info = {
            'endfor normal': len(tags_endfor),
            'endfor com {%r': len(tags_r_endfor),
            'endfor com {%p': len(tags_p_endfor)
        }
        
        # 2.5 Tags 'for' iniciando loops
        tags_for = re.findall(r'\{%\s*for\s+[^%]*%\}', xml, re.IGNORECASE)
        tags_r_for = re.findall(r'\{%r\s*for\s+[^%]*%\}', xml, re.IGNORECASE)
        tags_p_for = re.findall(r'\{%p\s*for\s+[^%]*%\}', xml, re.IGNORECASE)
        
        for_info = {
            'for normal': len(tags_for),
            'for com {%r': len(tags_r_for),
            'for com {%p': len(tags_p_for)
        }
        
        # Exibir análise de loops
        print("🔄 ANÁLISE DE LOOPS:")
        print("\n  Abertura de loops:")
        for tipo, qtd in for_info.items():
            print(f"    • {tipo}: {qtd}")
        
        print("\n  Fechamento de loops:")
        for tipo, qtd in endfor_info.items():
            print(f"    • {tipo}: {qtd}")
        
        # Verificar se está balanceado
        total_for = sum(for_info.values())
        total_endfor = sum(endfor_info.values())
        
        if total_for != total_endfor:
            print(f"\n  ⚠️  DESBALANCEADO! {total_for} aberturas vs {total_endfor} fechamentos")
        else:
            print(f"\n  ✅ Balanceado: {total_for} loops completos")
        
        # Exibir problemas encontrados
        if problemas:
            print("\n" + "=" * 70)
            print("❌ PROBLEMAS ENCONTRADOS:\n")
            
            for idx, (descricao, tags) in enumerate(problemas, 1):
                print(f"{idx}. {descricao}")
                print(f"   Quantidade: {len(tags)}")
                for tag_idx, tag in enumerate(tags[:5], 1):  # Mostrar no máximo 5
                    print(f"   {tag_idx}. {tag}")
                if len(tags) > 5:
                    print(f"   ... e mais {len(tags) - 5}")
                print()
        
        # Listar todas as tags únicas
        print("=" * 70)
        print("📋 TODAS AS TAGS ÚNICAS ENCONTRADAS:\n")
        
        tags_unicas = sorted(set(todas_tags))
        for idx, tag in enumerate(tags_unicas, 1):
            # Contar quantas vezes aparece
            count = todas_tags.count(tag)
            print(f"{idx:3d}. {tag:50s} (x{count})")
        
        print("\n" + "=" * 70)
        
        # Dica final
        if problemas:
            print("\n💡 AÇÕES NECESSÁRIAS:")
            print("\n1. Abra o arquivo no Word")
            print("2. Pressione Ctrl+H (Localizar e Substituir)")
            print("3. Para cada problema acima, faça as correções:")
            print("   • {% tr for → {%r for")
            print("   • {% tr endfor → {%r endfor")
            print("   • {% r endfor → {%r endfor (remover espaço)")
            print("   • {% p endfor → {%p endfor (remover espaço)")
            print("4. Salve o arquivo (Ctrl+S)")
        else:
            print("\n✅ Nenhum problema crítico encontrado!")
            print("   Se ainda houver erros, pode ser formatação XML do Word.")
        
except FileNotFoundError:
    print(f"❌ Arquivo não encontrado: {TEMPLATE}")
    print("   Verifique se o caminho está correto.")
except Exception as e:
    print(f"❌ Erro ao processar: {e}")
