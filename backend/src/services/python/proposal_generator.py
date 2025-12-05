"""
Gerador de Propostas de Energia Solar
Migração de Node.js para Python usando docxtpl (Jinja2)

Autor: Sistema de Geração de Propostas
Data: 2025-12-03
"""

import matplotlib
matplotlib.use('Agg')  # Backend sem GUI para ambientes sem display
import matplotlib.pyplot as plt
import io
import os
import sys
import json
import traceback
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
    
    def __init__(self, template_path, silent=False):
        """
        Inicializa o gerador com o template DOCX
        
        Args:
            template_path (str): Caminho para o arquivo template .docx
            silent (bool): Se True, desabilita todos os prints (modo produção)
            
        Raises:
            FileNotFoundError: Se o template não existir
        """
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template não encontrado: {template_path}")
        
        self.template_path = template_path
        self.doc = DocxTemplate(template_path)
        self.silent = silent
        # Print removido em modo produção - pode causar buffering
    
    def _print(self, *args, **kwargs):
        """Print condicional - só imprime se não estiver em modo silencioso"""
        if not self.silent:
            print(*args, **kwargs)

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

    def gerar_grafico_retorno(self, tabela_fluxo):
        """
        Gera o gráfico de barras do retorno financeiro (25 anos)
        
        Args:
            tabela_fluxo (list): Lista com dados do fluxo de caixa
            
        Returns:
            InlineImage: Objeto de imagem para inserção no DOCX
        """
        # Extrair dados do fluxo
        anos = [int(item['ano']) for item in tabela_fluxo]
        
        # Converter economia acumulada para números (remover "R$", ".", e substituir "," por ".")
        valores_acumulados = []
        for item in tabela_fluxo:
            valor_str = item['eco_ac'].replace('R$', '').replace('.', '').replace(',', '.').strip()
            valor = float(valor_str)
            valores_acumulados.append(valor)
        
        # Criar figura maior para acomodar 25 barras
        plt.figure(figsize=(14, 5))
        
        # Criar barras - vermelhas para valores negativos, verdes para positivos
        cores = ['#dc3545' if v < 0 else '#28a745' for v in valores_acumulados]
        
        plt.bar(anos, valores_acumulados, color=cores, width=0.7, alpha=0.85, edgecolor='white', linewidth=0.5)
        
        # Linha zero
        plt.axhline(y=0, color='black', linestyle='-', linewidth=1.5, alpha=0.5)
        
        # Configurações visuais
        plt.title('SEU RETORNO', fontsize=18, fontweight='bold', pad=20)
        plt.xlabel('', fontsize=11)  # Sem label no eixo X
        plt.ylabel('', fontsize=11)  # Sem label no eixo Y
        
        # Configurar eixo X para mostrar todos os anos
        plt.xticks(anos, anos, fontsize=8, rotation=0)
        
        # Formatação do eixo Y - valores em milhares
        ax = plt.gca()
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{int(x/1000)}'))
        
        # Adicionar legenda do fluxo de caixa abaixo das barras
        for i, (ano, valor) in enumerate(zip(anos, valores_acumulados)):
            if i % 2 == 0 or ano in [1, 5, 10, 15, 20, 25]:  # Mostrar valores alternados
                ax.text(ano, -50000, f'{int(valor/1000)}', 
                       ha='center', va='top', fontsize=7, color='#555')
        
        # Remover bordas superiores e direitas
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_visible(False)
        
        # Grid horizontal leve
        ax.grid(axis='y', alpha=0.2, linestyle='--', linewidth=0.5)
        ax.set_axisbelow(True)
        
        # Ajustar limites do eixo Y
        ymin = min(valores_acumulados) * 1.2 if min(valores_acumulados) < 0 else -10000
        ymax = max(valores_acumulados) * 1.1
        ax.set_ylim(ymin, ymax)
        
        plt.tight_layout()
        
        # Salvar em buffer com DPI maior
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight', facecolor='white')
        plt.close()
        buffer.seek(0)
        
        return InlineImage(self.doc, buffer, width=Mm(180))

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
        
        # Calcular economia acumulada para anos específicos (1, 5, 10, 25)
        economia_ano_1 = None
        economia_ano_5 = None
        economia_ano_10 = None
        economia_ano_25 = None
        
        for ano in range(1, 26):
            # Inflação energética estimada em 5% ao ano
            fator_inflacao = 1.05 ** (ano - 1)
            econ_atual = economia_anual_base * fator_inflacao
            saldo += econ_atual
            
            # Cálculos auxiliares
            tarifa_ano = 0.92 * fator_inflacao
            fatura_sem_solar = 1200 * 12 * tarifa_ano
            economia_acumulada = saldo + valor_investimento
            
            # Guardar valores específicos
            if ano == 1:
                economia_ano_1 = f"R$ {economia_acumulada:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            elif ano == 5:
                economia_ano_5 = f"R$ {economia_acumulada:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            elif ano == 10:
                economia_ano_10 = f"R$ {economia_acumulada:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            elif ano == 25:
                economia_ano_25 = f"R$ {economia_acumulada:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            
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
                # Nomes conforme template Word
                'tar': f'{tarifa_ano:.2f}'.replace('.', ','),  # Tarifa em R$
                'tar_fb': '0,00',  # Tarifa Fio B
                'en_g': '15.000',  # Energia Gerada em kWh
                'en_cons': '12.000',  # Energia Consumida em kWh
                'cred_ac': '3.000',  # Crédito Acumulado em kWh
                
                # Valores financeiros deste ano
                'fat_s_sol': f"R$ {fatura_sem_solar:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),  # Fatura Sem Solar
                'fat_c_sol': 'R$ 100,00',  # Fatura Com Solar
                'eco': f"R$ {econ_atual:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),  # Economia
                'eco_ac': f"R$ {economia_acumulada:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),  # Economia Acumulada
                'payback': texto_payback,
                
                # Valores para tabela de rentabilidade (mesmo em todos os anos)
                'inves': f"R$ {valor_investimento:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'mensal': f"R$ {econ_atual/12:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                
                # Anos específicos para tabela de rentabilidade (todos os itens têm os mesmos valores)
                'anoa': economia_ano_1 if economia_ano_1 else 'R$ 0,00',
                'anob': economia_ano_5 if economia_ano_5 else 'R$ 0,00',
                'anoc': economia_ano_10 if economia_ano_10 else 'R$ 0,00',
                'anod': economia_ano_25 if economia_ano_25 else 'R$ 0,00',
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
        self._print("\n" + "="*70)
        self._print("INICIANDO GERACAO DE PROPOSTA")
        self._print("="*70)
        
        # 1. Gerar gráficos
        self._print("\n1. Gerando graficos...")
        img_comparativo = self.gerar_grafico_comparativo()
        self._print("   OK Grafico comparativo criado")
        
        # 2. Calcular tabelas financeiras
        self._print("\n2. Calculando tabelas financeiras...")
        valor_inv = dados_cliente.get('valor_investimento', 25000)
        tabela_fluxo = self.calcular_fluxo_caixa(valor_inv)
        self._print(f"   OK Fluxo de caixa calculado (25 anos)")
        
        # 3. Gerar gráfico de retorno
        self._print("\n3. Gerando grafico de retorno...")
        img_retorno = self.gerar_grafico_retorno(tabela_fluxo)
        self._print("   OK Grafico de retorno criado")
        self._print(f"   OK Fluxo de caixa calculado (25 anos)")
        
        # Extrair valores específicos para tabela de rentabilidade (anos 1, 5, 10, 25)
        valores_rentabilidade = {
            'ano_1': tabela_fluxo[0]['eco_ac'],  # Economia acumulada no ano 1
            'ano_5': tabela_fluxo[4]['eco_ac'],  # Economia acumulada no ano 5
            'ano_10': tabela_fluxo[9]['eco_ac'],  # Economia acumulada no ano 10
            'ano_25': tabela_fluxo[24]['eco_ac'],  # Economia acumulada no ano 25
        }
        
        # Calcular rentabilidade para comparação (Energia Solar, Poupança, CDB)
        mensal_solar = float(tabela_fluxo[0]['mensal'].replace('R$', '').replace('.', '').replace(',', '.').strip())
        
        # Poupança (0,5% ao mês)
        poup_ano1 = mensal_solar * 12 * 1.005**6  # 6 meses de rendimento médio
        poup_ano5 = poup_ano1 * ((1.005**60 - 1) / 0.005)  # Série uniforme 60 meses
        poup_ano10 = poup_ano1 * ((1.005**120 - 1) / 0.005)
        poup_ano25 = poup_ano1 * ((1.005**300 - 1) / 0.005)
        
        # CDB (0,8% ao mês)
        cdb_ano1 = mensal_solar * 12 * 1.008**6
        cdb_ano5 = cdb_ano1 * ((1.008**60 - 1) / 0.008)
        cdb_ano10 = cdb_ano1 * ((1.008**120 - 1) / 0.008)
        cdb_ano25 = cdb_ano1 * ((1.008**300 - 1) / 0.008)
        
        # Criar array para tabela de rentabilidade (3 cenários)
        tabela_rentabilidade = [
            {
                'tipo': 'Energia Solar',
                'investimento': f"R$ {valor_inv:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'mensal': tabela_fluxo[0]['mensal'],
                'ano1': valores_rentabilidade['ano_1'],
                'ano5': valores_rentabilidade['ano_5'],
                'ano10': valores_rentabilidade['ano_10'],
                'ano25': valores_rentabilidade['ano_25'],
                # Nomes alternativos
                '1ano': valores_rentabilidade['ano_1'],
                '5anos': valores_rentabilidade['ano_5'],
                '10anos': valores_rentabilidade['ano_10'],
                '25anos': valores_rentabilidade['ano_25'],
            },
            {
                'tipo': 'Poupança',
                'investimento': f"R$ {valor_inv:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'mensal': f"R$ {mensal_solar * 0.75:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano1': f"R$ {poup_ano1:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano5': f"R$ {poup_ano5:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano10': f"R$ {poup_ano10:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano25': f"R$ {poup_ano25:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                # Nomes alternativos
                '1ano': f"R$ {poup_ano1:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                '5anos': f"R$ {poup_ano5:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                '10anos': f"R$ {poup_ano10:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                '25anos': f"R$ {poup_ano25:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            },
            {
                'tipo': 'CDB',
                'investimento': f"R$ {valor_inv:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'mensal': f"R$ {mensal_solar * 1.02:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano1': f"R$ {cdb_ano1:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano5': f"R$ {cdb_ano5:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano10': f"R$ {cdb_ano10:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                'ano25': f"R$ {cdb_ano25:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                # Nomes alternativos
                '1ano': f"R$ {cdb_ano1:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                '5anos': f"R$ {cdb_ano5:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                '10anos': f"R$ {cdb_ano10:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
                '25anos': f"R$ {cdb_ano25:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            }
        ]
        
        # 4. Montar contexto completo
        self._print("\n4. Montando contexto de variaveis...")
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
            
            # --- Tabela de Rentabilidade (3 cenários de comparação) ---
            'rentabilidade': tabela_rentabilidade,
            
            # --- Variáveis da Tabela de Rentabilidade (SEM LOOP) ---
            'inves': f"R$ {valor_inv:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            'mensal': tabela_fluxo[0]['mensal'],  # Economia mensal do primeiro ano
            
            # Variáveis com nomes alternativos (caso você use nomes diferentes no template)
            'ano_1': valores_rentabilidade['ano_1'],
            'ano_5': valores_rentabilidade['ano_5'],
            'ano_10': valores_rentabilidade['ano_10'],
            'ano_25': valores_rentabilidade['ano_25'],
            
            # Nomes alternativos para anos (anoa, anob, anoc, anod)
            'anoa': valores_rentabilidade['ano_1'],
            'anob': valores_rentabilidade['ano_5'],
            'anoc': valores_rentabilidade['ano_10'],
            'anod': valores_rentabilidade['ano_25'],
            
            # --- Imagens Geradas ---
            'grafico_comparativo': img_comparativo,
            'grafico_retorno': img_retorno,
        }
        
        total_vars = len([k for k in contexto.keys() if not isinstance(contexto[k], (list, InlineImage))])
        self._print(f"   OK {total_vars} variaveis simples")
        self._print(f"   OK {len(contexto['simulacao'])} simulacoes de financiamento")
        self._print(f"   OK {len(contexto['fluxo'])} anos de fluxo de caixa")
        self._print(f"   OK {len(contexto['rentabilidade'])} cenarios de rentabilidade")
        self._print(f"   OK 2 graficos gerados")

        # 5. Renderizar documento
        self._print("\n5. Renderizando documento...")
        try:
            # IMPORTANTE: NÃO passar jinja_env customizado
            # docxtpl precisa processar tags especiais do Word ({% tr %}) internamente
            # antes de passar para Jinja2
            self.doc.render(contexto)
            self._print("   OK Template renderizado com sucesso")
        except Exception as e:
            self._print(f"   ERRO ao renderizar: {str(e)}")
            self._print(f"   Dica: Verifique se o template usa tags Jinja2 validas")
            self._print(f"   Tags especiais do Word: {{% tr for item in lista %}} ... {{% tr endfor %}}")
            raise
        
        # 5. Salvar arquivo
        self._print(f"\n6. Salvando em: {output_path}")
        try:
            self.doc.save(output_path)
            file_size = os.path.getsize(output_path) / 1024  # KB
            self._print(f"   OK Arquivo salvo ({file_size:.1f} KB)")
        except Exception as e:
            self._print(f"   ERRO ao salvar: {str(e)}")
            raise
        
        self._print("\n" + "="*70)
        self._print("PROPOSTA GERADA COM SUCESSO!")
        self._print("="*70)
        self._print(f"Arquivo: {os.path.basename(output_path)}")
        self._print(f"Caminho: {os.path.abspath(output_path)}")
        self._print("="*70 + "\n")
        
        return output_path


# --- Modo de Execução: Teste ou Produção ---
if __name__ == "__main__":
    import sys
    import json
    
    # Detectar modo de execução
    if len(sys.argv) > 1 and sys.argv[1] == "--production":
        """
        MODO PRODUÇÃO: Recebe JSON via stdin
        Chamado pelo backend TypeScript
        """
        try:
            # Ler JSON do stdin
            input_data = sys.stdin.read()
            
            if not input_data:
                print(json.dumps({
                    'success': False,
                    'error': 'Nenhum dado recebido via stdin'
                }), flush=True)
                sys.exit(1)
            
            params = json.loads(input_data)
            
            # Extrair parâmetros
            template_path = params.get('template_path')
            output_path = params.get('output_path')
            dados_cliente = params.get('dados_cliente', {})
            
            if not template_path or not output_path:
                print(json.dumps({
                    'success': False,
                    'error': 'Parâmetros obrigatórios: template_path, output_path'
                }), flush=True)
                sys.exit(1)
            
            # Gerar proposta em modo silencioso
            try:
                gerador = GeradorPropostaSolar(template_path, silent=True)
            except Exception as e:
                error_json = json.dumps({
                    'success': False,
                    'error': f'Erro ao criar gerador: {str(e)}',
                    'traceback': traceback.format_exc()
                })
                print(error_json, flush=True)
                sys.exit(1)
            
            try:
                arquivo_gerado = gerador.gerar(dados_cliente, output_path)
            except Exception as e:
                error_json = json.dumps({
                    'success': False,
                    'error': f'Erro ao gerar documento: {str(e)}',
                    'traceback': traceback.format_exc()
                })
                print(error_json, flush=True)
                sys.exit(1)
            
            # Retornar sucesso
            print(json.dumps({
                'success': True,
                'generated_path': arquivo_gerado,
                'file_size': os.path.getsize(arquivo_gerado)
            }), flush=True)
            sys.exit(0)
            
        except Exception as e:
            # Retornar erro - VAI PARA STDOUT!
            error_json = json.dumps({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            })
            print(error_json, flush=True)  # STDOUT!
            sys.exit(1)
    
    else:
        """
        MODO TESTE: Execução standalone
        Execute: python proposal_generator.py
        """
        import traceback
        
        print("\n*** MODO DE TESTE - Gerador de Propostas Solar\n")
        
        # Caminho do template (ajuste se necessário)
        TEMPLATE = r"C:\Users\roger\Downloads\Proposta 2025 - CORRIGIDO.docx"
        SAIDA = "Proposta_Gerada_Teste.docx"
        
        # Verificar se template existe
        if not os.path.exists(TEMPLATE):
            print(f"ERRO: Template não encontrado: {TEMPLATE}")
            print("Dica: Ajuste o caminho na variável TEMPLATE")
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
            
            print(f"\n*** Teste concluído! Abra o arquivo: {arquivo_gerado}\n")
            
        except FileNotFoundError as e:
            print(f"\nERRO: {e}")
            print("Dica: Verifique se o template está no caminho correto\n")
        except Exception as e:
            print(f"\nERRO ao gerar proposta: {e}")
            traceback.print_exc()
