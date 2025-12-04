"""
Script de Teste - Geração de Proposta Solar
Valida a integração completa do sistema de geração de propostas

Execute: python test_generation.py
"""

import sys
import os
from pathlib import Path

# Adicionar diretório pai ao PATH para importar módulos
sys.path.insert(0, str(Path(__file__).parent))

from proposal_generator import GeradorPropostaSolar


def teste_basico():
    """Teste básico com dados mínimos"""
    print("\n" + "="*80)
    print("🧪 TESTE 1: Geração Básica")
    print("="*80)
    
    template = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    output = "Proposta_Teste_Basico.docx"
    
    if not os.path.exists(template):
        print(f"❌ Template não encontrado: {template}")
        return False
    
    dados = {
        'nome': 'João Silva',
        'doc': '123.456.789-00',
        'valor_investimento': 25000.00
    }
    
    try:
        gerador = GeradorPropostaSolar(template)
        arquivo = gerador.gerar(dados, output)
        print(f"✅ Teste básico passou! Arquivo: {arquivo}\n")
        return True
    except Exception as e:
        print(f"❌ Teste básico falhou: {e}\n")
        return False


def teste_completo():
    """Teste com todos os dados preenchidos"""
    print("\n" + "="*80)
    print("🧪 TESTE 2: Geração Completa (Todos os Campos)")
    print("="*80)
    
    template = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    output = "Proposta_Teste_Completo.docx"
    
    if not os.path.exists(template):
        print(f"❌ Template não encontrado: {template}")
        return False
    
    dados = {
        # Cliente
        'nome': 'Maria Santos Oliveira',
        'doc': '987.654.321-00',
        'email': 'maria.santos@exemplo.com',
        'telefone': '(11) 91234-5678',
        'endereco': 'Rua das Flores, 456 - Jardim Paulista - São Paulo/SP',
        
        # Sistema
        'valor_investimento': 45000.00,
        'potencia': '10.5 kWp',
        'num_paineis': '20',
        'producao_media': '1.300 kWh',
        'consumo_medio': '1.100 kWh',
        'area': '55 m²',
        
        # Financeiro
        'payback_anos': '4,2',
        'percentual_retorno': '32%',
        'valor_conta_atual': 'R$ 1.850,00',
        'economia_mensal': 'R$ 1.650,00',
        
        # Vendedor/Empresa
        'vendedor': 'Carlos Eduardo Silva',
        'celular_vendedor': '(11) 98888-7777',
        'email_vendedor': 'carlos@solartech.com.br',
        'empresa': 'Solar Tech Brasil LTDA',
        
        # Simulações personalizadas
        'simulacoes': [
            {'banco': 'Santander Solar', 'parcelas': '36x', 'valor': 'R$ 1.550,00'},
            {'banco': 'BV Financeira', 'parcelas': '48x', 'valor': 'R$ 1.250,00'},
            {'banco': 'Banco do Brasil', 'parcelas': '60x', 'valor': 'R$ 1.050,00'},
            {'banco': 'Sicoob', 'parcelas': '72x', 'valor': 'R$ 920,00'},
        ],
        
        # Itens personalizados
        'itens': [
            {'desc': 'Módulos Fotovoltaicos 550W Monocristalino', 'qtd': '20'},
            {'desc': 'Inversor On-Grid 10kW Trifásico', 'qtd': '1'},
            {'desc': 'Estrutura de Fixação em Alumínio', 'qtd': '6'},
            {'desc': 'String Box CC/CA com proteções', 'qtd': '1'},
            {'desc': 'Cabos Solares 6mm² - 100 metros', 'qtd': '1'},
            {'desc': 'Conectores MC4 (pares)', 'qtd': '40'},
            {'desc': 'Sistema de Monitoramento WiFi', 'qtd': '1'},
        ],
    }
    
    try:
        gerador = GeradorPropostaSolar(template)
        arquivo = gerador.gerar(dados, output)
        print(f"✅ Teste completo passou! Arquivo: {arquivo}\n")
        return True
    except Exception as e:
        print(f"❌ Teste completo falhou: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def teste_fluxo_caixa():
    """Teste específico de cálculo de fluxo de caixa"""
    print("\n" + "="*80)
    print("🧪 TESTE 3: Cálculo de Fluxo de Caixa")
    print("="*80)
    
    template = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    
    if not os.path.exists(template):
        print(f"❌ Template não encontrado: {template}")
        return False
    
    try:
        gerador = GeradorPropostaSolar(template)
        
        # Testar diferentes valores de investimento
        investimentos = [20000, 35000, 50000]
        
        for inv in investimentos:
            fluxo = gerador.calcular_fluxo_caixa(inv)
            
            # Validações
            assert len(fluxo) == 25, f"Fluxo deve ter 25 anos, tem {len(fluxo)}"
            assert fluxo[0]['ano'] == '1', "Primeiro ano deve ser '1'"
            assert fluxo[24]['ano'] == '25', "Último ano deve ser '25'"
            
            print(f"✅ Fluxo de caixa calculado para R$ {inv:,.2f}")
            print(f"   - Ano 1: {fluxo[0]['econ']} de economia")
            print(f"   - Ano 25: {fluxo[24]['acum']} acumulado")
            print(f"   - Payback Ano 5: {fluxo[4]['payback']}")
        
        print("\n✅ Teste de fluxo de caixa passou!\n")
        return True
        
    except Exception as e:
        print(f"❌ Teste de fluxo de caixa falhou: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def teste_graficos():
    """Teste específico de geração de gráficos"""
    print("\n" + "="*80)
    print("🧪 TESTE 4: Geração de Gráficos")
    print("="*80)
    
    template = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    
    if not os.path.exists(template):
        print(f"❌ Template não encontrado: {template}")
        return False
    
    try:
        gerador = GeradorPropostaSolar(template)
        
        print("📊 Gerando gráfico comparativo...")
        grafico = gerador.gerar_grafico_comparativo()
        
        # Validar tipo
        from docxtpl import InlineImage
        assert isinstance(grafico, InlineImage), "Gráfico deve ser InlineImage"
        
        print("✅ Gráfico gerado com sucesso (InlineImage)")
        print("✅ Teste de gráficos passou!\n")
        return True
        
    except Exception as e:
        print(f"❌ Teste de gráficos falhou: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def executar_todos_testes():
    """Executa todos os testes em sequência"""
    print("\n" + "="*80)
    print("🚀 INICIANDO SUITE DE TESTES - Gerador de Propostas Solar")
    print("="*80)
    
    resultados = []
    
    # Teste 1: Básico
    resultados.append(("Teste Básico", teste_basico()))
    
    # Teste 2: Completo
    resultados.append(("Teste Completo", teste_completo()))
    
    # Teste 3: Fluxo de Caixa
    resultados.append(("Teste Fluxo de Caixa", teste_fluxo_caixa()))
    
    # Teste 4: Gráficos
    resultados.append(("Teste Gráficos", teste_graficos()))
    
    # Resumo
    print("\n" + "="*80)
    print("📊 RESUMO DOS TESTES")
    print("="*80)
    
    passou = 0
    falhou = 0
    
    for nome, resultado in resultados:
        status = "✅ PASSOU" if resultado else "❌ FALHOU"
        print(f"{status} - {nome}")
        if resultado:
            passou += 1
        else:
            falhou += 1
    
    print("="*80)
    print(f"Total: {len(resultados)} testes")
    print(f"✅ Passaram: {passou}")
    print(f"❌ Falharam: {falhou}")
    print("="*80 + "\n")
    
    return falhou == 0


if __name__ == "__main__":
    """
    Ponto de entrada do script de teste
    """
    print("\n🔬 SISTEMA DE TESTES - Gerador de Propostas Python\n")
    
    # Verificar se template existe
    template_path = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    if not os.path.exists(template_path):
        print("="*80)
        print("⚠️  ATENÇÃO: Template não encontrado!")
        print("="*80)
        print(f"📁 Caminho esperado: {template_path}")
        print("\n💡 Soluções:")
        print("   1. Copie o template para o caminho acima")
        print("   2. Ou edite a variável 'template' nos testes")
        print("="*80 + "\n")
        sys.exit(1)
    
    # Executar testes
    sucesso = executar_todos_testes()
    
    if sucesso:
        print("🎉 Todos os testes passaram! Sistema pronto para produção.\n")
        sys.exit(0)
    else:
        print("⚠️  Alguns testes falharam. Revise os erros acima.\n")
        sys.exit(1)
