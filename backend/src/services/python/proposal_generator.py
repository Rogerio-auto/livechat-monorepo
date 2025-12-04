"""
Gerador de Propostas de Energia Solar
Migração de Node.js para Python usando docxtpl (Jinja2)

Autor: Sistema de Geração de Propostas
Data: 2025-12-03
"""

import matplotlib.pyplot as plt
import io
import os
from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm


class GeradorPropostaSolar:
    """
    Classe responsável por gerar propostas comerciais de Energia Solar em DOCX
    
    Features:
    - Cálculo automático de fluxo de caixa (25 anos)
    - Geração de gráficos com matplotlib
    - Renderização de templates Jinja2 com docxtpl
    - Suporte a tabelas dinâmicas e imagens inline
    """
    
    def __init__(self, template_path):
        """
        Inicializa o gerador com o template DOCX
        
        Args:
            template_path (str): Caminho para o arquivo template .docx
            
        Raises:
            FileNotFoundError: Se o template não existir
        """
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template não encontrado: {template_path}")
        
        self.template_path = template_path
        self.doc = DocxTemplate(template_path)
        print(f"📄 Template carregado: {os.path.basename(template_path)}")

    def gerar_grafico_comparativo(self):
        """
        Gera o gráfico de barras comparativo Consumo x Geração
        
        Returns:
            InlineImage: Objeto de imagem para inserção no DOCX
        """
        # Dados de exemplo (futuramente podem vir como parâmetro)
        meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        consumo = [1200] * 12  # Consumo constante
        geracao = [1500, 1450, 1600, 1550, 1400, 1300, 1350, 1500, 1600, 1650, 1500, 1450]

        # Criar figura
        plt.figure(figsize=(8, 4))
        
        # Plotar barras lado a lado
        x = range(len(meses))
        width = 0.35
        
        plt.bar([i - width/2 for i in x], consumo, width=width, 
                color='#76b900', label='Consumo', alpha=0.8)
        plt.bar([i + width/2 for i in x], geracao, width=width, 
                color='#008EC4', label='Geração', alpha=0.8)
        
        # Configurações visuais
        plt.title('COMPARATIVO CONSUMO x GERAÇÃO', fontsize=14, fontweight='bold')
        plt.xlabel('Mês', fontsize=10)
        plt.ylabel('Energia (kWh)', fontsize=10)
        plt.xticks(x, meses, rotation=45, ha='right')
        plt.legend(loc='upper right')
        plt.tight_layout()
        
        # Remover bordas desnecessárias
        ax = plt.gca()
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        
        # Grid leve
        ax.grid(axis='y', alpha=0.3, linestyle='--', linewidth=0.5)

        # Salvar em buffer de memória (sem arquivo em disco)
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()  # Liberar memória
        buffer.seek(0)
        
        # Retornar como InlineImage
        return InlineImage(self.doc, buffer, width=Mm(160))

    def calcular_fluxo_caixa(self, valor_investimento=25000):
        """
        Calcula a tabela de fluxo de caixa projetado para 25 anos
        
        Args:
            valor_investimento (float): Valor do investimento inicial em R$
            
        Returns:
            list: Lista de dicionários com dados anuais do fluxo de caixa
        """
        lista_fluxo = []
        economia_anual_base = 13700  # Economia base estimada (R$/ano)
        saldo = -valor_investimento  # Começa negativo (investimento)
        
        for ano in range(1, 26):
            # Inflação energética estimada em 5% ao ano
            fator_inflacao = 1.05 ** (ano - 1)
            econ_atual = economia_anual_base * fator_inflacao
            saldo += econ_atual
            
            # Cálculos auxiliares
            tarifa_ano = 0.92 * fator_inflacao
            fatura_sem_solar = 1200 * 12 * tarifa_ano
            economia_acumulada = saldo + valor_investimento
            
            # Formatação do Payback (negativo até atingir break-even)
            if saldo > 0:
                texto_payback = f"R$ {saldo:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            else:
                texto_payback = f"-R$ {abs(saldo):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            
            # Montar linha da tabela - cada linha representa UM ANO específico
            linha_fluxo = {
                # Ano atual (usado na primeira coluna)
                'ano': str(ano),
                
                # Dados técnicos e financeiros DESTE ANO específico
                'tarifa': f'{tarifa_ano:.2f}'.replace('.', ','),
                'fiob': '0,00',
                'gerada': '15.000',  # kWh gerados por ano
                'consum': '12.000',  # kWh consumidos por ano
                'credito': '3.000',  # kWh de crédito
                
                # Valores financeiros deste ano
                'fat_sem': f"R$ {fatura_sem_solar:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'fat_com': 'R$ 100,00',
                'econ': f"R$ {econ_atual:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'mensal': f"R$ {econ_atual/12:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'acum': f"R$ {economia_acumulada:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'payback': texto_payback,
                'inves': f"R$ {valor_investimento:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            }
            
            lista_fluxo.append(linha_fluxo)
        
        return lista_fluxo

    def gerar(self, dados_cliente, output_path):
        """
        Gera a proposta completa em DOCX
        
        Args:
            dados_cliente (dict): Dicionário com dados do cliente
                Campos obrigatórios: nome, doc
                Campos opcionais: email, valor_investimento
            output_path (str): Caminho para salvar o arquivo gerado
            
        Returns:
            str: Caminho do arquivo gerado
        """
        print("\n" + "="*70)
        print("🚀 INICIANDO GERAÇÃO DE PROPOSTA")
        print("="*70)
        
        # 1. Gerar gráficos
        print("\n1️⃣ Gerando gráficos...")
        img_comparativo = self.gerar_grafico_comparativo()
        print("   ✅ Gráfico comparativo criado")
        
        # 2. Calcular tabelas financeiras
        print("\n2️⃣ Calculando tabelas financeiras...")
        valor_inv = dados_cliente.get('valor_investimento', 25000)
        tabela_fluxo = self.calcular_fluxo_caixa(valor_inv)
        print(f"   ✅ Fluxo de caixa calculado (25 anos)")
        
        # 3. Montar contexto completo
        print("\n3️⃣ Montando contexto de variáveis...")
        contexto = {
            # --- Dados do Cliente ---
            'NOME_CLIENTE': dados_cliente.get('nome', 'CLIENTE NÃO INFORMADO'),
            'CPF_CNPJ_CLIENTE': dados_cliente.get('doc', '000.000.000-00'),
            'EMAIL_CLIENTE': dados_cliente.get('email', 'nao_informado@email.com'),
            'ENDE_CLIENTE': dados_cliente.get('endereco', 'Endereço não informado'),
            'CELULAR_CLIENTE': dados_cliente.get('telefone', '(00) 00000-0000'),
            
            # --- Dados do Vendedor ---
            'NOME_VENDEDOR': dados_cliente.get('vendedor', 'Consultor Solar'),
            'CELULAR_VENDEDOR': dados_cliente.get('celular_vendedor', '(11) 99999-9999'),
            'EMAIL_VENDEDOR': dados_cliente.get('email_vendedor', 'vendedor@empresa.com'),
            
            # --- Dados da Empresa ---
            'NOME_EMPRESA_DOC': dados_cliente.get('empresa', 'Empresa Solar LTDA'),
            'CNPJ': '00.000.000/0001-00',
            'ENDE_EMPRESA': 'Rua da Energia Solar, 123',
            'CELULAR_EMPRESA': '(11) 3333-3333',
            
            # --- Dados Técnicos do Sistema ---
            'POT_TOTAL': dados_cliente.get('potencia', '5.5 kWp'),
            'NUM_PAINEL': dados_cliente.get('num_paineis', '10'),
            'PRODU_MEDIA': dados_cliente.get('producao_media', '650 kWh'),
            'AREA_TOTAL': dados_cliente.get('area', '30 m²'),
            'CONSU_MEDIO': dados_cliente.get('consumo_medio', '600 kWh'),
            
            # --- Valores Financeiros ---
            'VAL_INVEST': f"R$ {valor_inv:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            'VALOR_POR_WP': 'R$ 4,55',
            'VALOR_CONTA_ATUAL': dados_cliente.get('valor_conta_atual', 'R$ 1.200,00'),
            'VALOR_CONTA_SOLAR': 'R$ 100,00',
            'VALOR_ECONOMIA': dados_cliente.get('economia_mensal', 'R$ 1.100,00'),
            
            # --- Prazos e Garantias ---
            'VALID_PROP': '10 Dias',
            'PRAZO_ENTR': '30 Dias',
            'GARAN_PAINEL': '25 Anos',
            'GARAN_INVER': '10 Anos',
            'GARAN_ESTRU': '10 Anos',
            'GARAN_SERVI': '1 Ano',
            
            # --- Payback e ROI ---
            'ANO_PAYBACK': dados_cliente.get('payback_anos', '3,5'),
            'PERC_RETORNO': dados_cliente.get('percentual_retorno', '28%'),
            
            # --- Dados Ecológicos ---
            'CO2_ARVORES': '150',
            'CO2_CARROS': '5',
            'CO2_25': '75',
            
            # --- Condições Comerciais ---
            'CONDICAO_PAGAMENTO': dados_cliente.get('condicao_pagamento', 'À vista ou financiado'),
            'FORMA_PAGAMENTO': 'PIX, Boleto, Cartão ou Financiamento',
            'ESPECIFICACAO_KIT': 'Kit Premium c/ Monitoramento WiFi',
            
            # --- Tabelas Dinâmicas ---
            'simulacao': dados_cliente.get('simulacoes', [
                {'banco': 'Santander', 'parcelas': '24x', 'valor': 'R$ 1.500,00'},
                {'banco': 'BV Financeira', 'parcelas': '36x', 'valor': 'R$ 1.100,00'},
                {'banco': 'Banco do Brasil', 'parcelas': '48x', 'valor': 'R$ 850,00'},
            ]),
            
            'tabela_itens': dados_cliente.get('itens', [
                {'desc': 'Módulos Fotovoltaicos 550W', 'qtd': '10'},
                {'desc': 'Inversor 5kW', 'qtd': '1'},
                {'desc': 'Estrutura de Fixação', 'qtd': '4'},
                {'desc': 'Cabos e Conectores', 'qtd': '1 kit'},
            ]),
            
            'fluxo': tabela_fluxo,
            
            # --- Imagens Geradas ---
            'grafico_comparativo': img_comparativo,
        }
        
        total_vars = len([k for k in contexto.keys() if not isinstance(contexto[k], (list, InlineImage))])
        print(f"   ✅ {total_vars} variáveis simples")
        print(f"   ✅ {len(contexto['simulacao'])} simulações de financiamento")
        print(f"   ✅ {len(contexto['fluxo'])} anos de fluxo de caixa")
        print(f"   ✅ 1 gráfico gerado")

        # 4. Renderizar documento
        print("\n4️⃣ Renderizando documento...")
        try:
            # IMPORTANTE: NÃO passar jinja_env customizado
            # docxtpl precisa processar tags especiais do Word ({% tr %}) internamente
            # antes de passar para Jinja2
            self.doc.render(contexto)
            print("   ✅ Template renderizado com sucesso")
        except Exception as e:
            print(f"   ❌ Erro ao renderizar: {str(e)}")
            print(f"   💡 Dica: Verifique se o template usa tags Jinja2 válidas")
            print(f"   💡 Tags especiais do Word: {{% tr for item in lista %}} ... {{% tr endfor %}}")
            raise
        
        # 5. Salvar arquivo
        print(f"\n5️⃣ Salvando em: {output_path}")
        try:
            self.doc.save(output_path)
            file_size = os.path.getsize(output_path) / 1024  # KB
            print(f"   ✅ Arquivo salvo ({file_size:.1f} KB)")
        except Exception as e:
            print(f"   ❌ Erro ao salvar: {str(e)}")
            raise
        
        print("\n" + "="*70)
        print("✅ PROPOSTA GERADA COM SUCESSO!")
        print("="*70)
        print(f"📁 Arquivo: {os.path.basename(output_path)}")
        print(f"📂 Caminho: {os.path.abspath(output_path)}")
        print("="*70 + "\n")
        
        return output_path


# --- Bloco de Teste Direto ---
if __name__ == "__main__":
    """
    Script de teste standalone
    Execute: python proposal_generator.py
    """
    
    print("\n🧪 MODO DE TESTE - Gerador de Propostas Solar\n")
    
    # Caminho do template (ajuste se necessário)
    TEMPLATE = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    SAIDA = "Proposta_Gerada_Teste.docx"
    
    # Verificar se template existe
    if not os.path.exists(TEMPLATE):
        print(f"❌ Template não encontrado: {TEMPLATE}")
        print("💡 Ajuste o caminho na variável TEMPLATE")
        exit(1)
    
    # Simulação de dados vindos do Front-end/Banco
    dados_mock = {
        'nome': 'CLIENTE TESTE INTEGRAÇÃO PYTHON',
        'doc': '123.456.789-00',
        'email': 'teste@exemplo.com',
        'telefone': '(11) 98765-4321',
        'endereco': 'Rua Teste, 123 - São Paulo/SP',
        'valor_investimento': 28500.00,
        'potencia': '6.6 kWp',
        'num_paineis': '12',
        'producao_media': '800 kWh',
        'consumo_medio': '700 kWh',
        'payback_anos': '3,8',
        'vendedor': 'Carlos Silva',
        'empresa': 'Solar Tech Brasil'
    }
    
    try:
        # Criar gerador e gerar proposta
        gerador = GeradorPropostaSolar(TEMPLATE)
        arquivo_gerado = gerador.gerar(dados_mock, SAIDA)
        
        print(f"\n🎉 Teste concluído! Abra o arquivo: {arquivo_gerado}\n")
        
    except FileNotFoundError as e:
        print(f"\n❌ Erro: {e}")
        print("💡 Verifique se o template está no caminho correto\n")
    except Exception as e:
        print(f"\n❌ Erro ao gerar proposta: {e}")
        import traceback
        traceback.print_exc()
