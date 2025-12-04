"""
Script de Introspecção de Template DOCX
Analisa um template .docx com tags Jinja2 e extrai todas as variáveis necessárias

Autor: Sistema de Análise de Templates
Data: 2025-12-03
"""

import re
import json
import zipfile
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict

class TemplateAnalyzer:
    """Analisador de templates DOCX com sintaxe Jinja2"""
    
    def __init__(self, template_path: str):
        self.template_path = Path(template_path)
        self.document_xml = None
        
        # Padrões regex para identificar variáveis
        self.simple_var_pattern = re.compile(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}')
        self.loop_start_pattern = re.compile(r'\{%\s*tr\s+for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}')
        self.loop_var_pattern = re.compile(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\.(.*?)\s*\}\}')
        
        # Gráficos conhecidos (imagens a serem geradas)
        self.known_images = ['grafico_retorno', 'grafico_comparativo', 'grafico_geracao', 'grafico_economia']
        
    def extract_xml(self) -> str:
        """Extrai o document.xml do arquivo DOCX"""
        if not self.template_path.exists():
            raise FileNotFoundError(f"Template não encontrado: {self.template_path}")
        
        try:
            with zipfile.ZipFile(self.template_path, 'r') as docx_zip:
                # Ler o document.xml principal
                with docx_zip.open('word/document.xml') as xml_file:
                    raw_xml = xml_file.read().decode('utf-8')
            
            # Limpar tags XML do Word que quebram as variáveis Jinja2
            # Problema: Word insere <w:t> tags que podem quebrar {{ variavel }}
            # Exemplo: {{<w:t>nome</w:t>_<w:t>cliente</w:t>}}
            
            # Remove todas as tags XML, mantendo apenas o texto
            clean_xml = re.sub(r'<w:t[^>]*>', '', raw_xml)
            clean_xml = re.sub(r'</w:t>', '', clean_xml)
            clean_xml = re.sub(r'<w:r[^>]*>', '', clean_xml)
            clean_xml = re.sub(r'</w:r>', '', clean_xml)
            
            self.document_xml = clean_xml
            
            print(f"✅ XML extraído com sucesso ({len(self.document_xml)} caracteres)")
            print(f"   (XML limpo para melhor detecção de variáveis)")
            return self.document_xml
            
        except Exception as e:
            raise Exception(f"Erro ao extrair XML do DOCX: {str(e)}")
    
    def find_simple_variables(self) -> Set[str]:
        """Encontra todas as variáveis simples {{ variavel }}"""
        if not self.document_xml:
            raise ValueError("XML não foi extraído. Execute extract_xml() primeiro.")
        
        variables = set()
        matches = self.simple_var_pattern.findall(self.document_xml)
        
        for var in matches:
            # Remover espaços e adicionar
            clean_var = var.strip()
            # Ignorar variáveis de loop (com ponto) e imagens
            if '.' not in clean_var and clean_var not in self.known_images:
                variables.add(clean_var)
        
        return variables
    
    def find_dynamic_tables(self) -> Dict[str, List[str]]:
        """Encontra tabelas dinâmicas e suas colunas"""
        if not self.document_xml:
            raise ValueError("XML não foi extraído. Execute extract_xml() primeiro.")
        
        tables = defaultdict(set)
        
        # Encontrar todos os loops
        loop_matches = self.loop_start_pattern.finditer(self.document_xml)
        
        for match in loop_matches:
            loop_var = match.group(1)  # Variável do loop (ex: 'item')
            list_name = match.group(2)  # Nome da lista (ex: 'equipamentos')
            
            # Encontrar o fim do loop
            start_pos = match.end()
            end_pattern = r'\{%\s*tr\s+endfor\s*%\}'
            end_match = re.search(end_pattern, self.document_xml[start_pos:])
            
            if end_match:
                # Extrair conteúdo entre o início e fim do loop
                loop_content = self.document_xml[start_pos:start_pos + end_match.start()]
                
                # Encontrar todas as propriedades usadas dentro do loop
                # Padrão: {{ item.propriedade }}
                property_pattern = re.compile(rf'\{{\{{\s*{loop_var}\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}}\}}')
                properties = property_pattern.findall(loop_content)
                
                for prop in properties:
                    tables[list_name].add(prop)
        
        # Converter sets para listas ordenadas
        return {table: sorted(list(columns)) for table, columns in tables.items()}
    
    def find_images(self) -> List[str]:
        """Encontra tags de imagens/gráficos"""
        if not self.document_xml:
            raise ValueError("XML não foi extraído. Execute extract_xml() primeiro.")
        
        images = []
        
        for img_name in self.known_images:
            pattern = rf'\{{\{{\s*{img_name}\s*\}}\}}'
            if re.search(pattern, self.document_xml):
                images.append(img_name)
        
        return sorted(images)
    
    def analyze(self) -> Dict:
        """Executa análise completa do template"""
        print("\n" + "="*70)
        print("🔍 ANÁLISE DE TEMPLATE DOCX")
        print("="*70)
        print(f"📁 Arquivo: {self.template_path.name}")
        print(f"📂 Caminho: {self.template_path}")
        print()
        
        # Extrair XML
        print("1️⃣ Extraindo XML do documento...")
        self.extract_xml()
        print()
        
        # Encontrar variáveis simples
        print("2️⃣ Analisando variáveis simples...")
        simple_vars = self.find_simple_variables()
        print(f"   ✓ Encontradas {len(simple_vars)} variáveis simples")
        print()
        
        # Encontrar tabelas dinâmicas
        print("3️⃣ Analisando tabelas dinâmicas...")
        dynamic_tables = self.find_dynamic_tables()
        print(f"   ✓ Encontradas {len(dynamic_tables)} tabelas dinâmicas")
        for table_name, columns in dynamic_tables.items():
            print(f"     - {table_name}: {len(columns)} colunas")
        print()
        
        # Encontrar imagens
        print("4️⃣ Analisando imagens/gráficos...")
        images = self.find_images()
        print(f"   ✓ Encontradas {len(images)} imagens")
        print()
        
        # Montar resultado
        result = {
            "template_info": {
                "filename": self.template_path.name,
                "path": str(self.template_path),
                "total_variables": len(simple_vars),
                "total_tables": len(dynamic_tables),
                "total_images": len(images)
            },
            "simple_keys": sorted(list(simple_vars)),
            "dynamic_tables": dynamic_tables,
            "images_to_generate": images
        }
        
        return result
    
    def print_results(self, result: Dict):
        """Imprime resultados de forma legível"""
        print("="*70)
        print("📊 RESULTADO DA ANÁLISE")
        print("="*70)
        print()
        
        # Info do template
        info = result["template_info"]
        print(f"📄 Template: {info['filename']}")
        print(f"📁 Caminho: {info['path']}")
        print(f"📊 Estatísticas:")
        print(f"   - Variáveis simples: {info['total_variables']}")
        print(f"   - Tabelas dinâmicas: {info['total_tables']}")
        print(f"   - Imagens/Gráficos: {info['total_images']}")
        print()
        
        # Variáveis simples
        if result["simple_keys"]:
            print("🔤 VARIÁVEIS SIMPLES ({{ variavel }}):")
            print("-" * 70)
            for i, var in enumerate(result["simple_keys"], 1):
                print(f"   {i:2d}. {var}")
            print()
        
        # Tabelas dinâmicas
        if result["dynamic_tables"]:
            print("📋 TABELAS DINÂMICAS ({% tr for item in lista %}):")
            print("-" * 70)
            for table_name, columns in result["dynamic_tables"].items():
                print(f"   📊 {table_name}:")
                for col in columns:
                    print(f"      - {col}")
                print()
        
        # Imagens
        if result["images_to_generate"]:
            print("🖼️  IMAGENS/GRÁFICOS (InlineImage):")
            print("-" * 70)
            for img in result["images_to_generate"]:
                print(f"   - {img}")
            print()
        
        print("="*70)
    
    def generate_sample_json(self, result: Dict) -> Dict:
        """Gera exemplo de dados JSON para preencher o template"""
        sample = {}
        
        # Variáveis simples - valores de exemplo
        for var in result["simple_keys"]:
            if "data" in var.lower():
                sample[var] = "01/12/2025"
            elif "valor" in var.lower() or "preco" in var.lower():
                sample[var] = "R$ 50.000,00"
            elif "nome" in var.lower():
                sample[var] = "João Silva"
            elif "email" in var.lower():
                sample[var] = "joao@email.com"
            elif "telefone" in var.lower() or "celular" in var.lower():
                sample[var] = "(11) 98765-4321"
            elif "numero" in var.lower():
                sample[var] = "P-2025-001"
            else:
                sample[var] = f"<valor_{var}>"
        
        # Tabelas dinâmicas - arrays de exemplo
        for table_name, columns in result["dynamic_tables"].items():
            sample[table_name] = [
                {col: f"<{col}_1>" for col in columns},
                {col: f"<{col}_2>" for col in columns}
            ]
        
        # Imagens - placeholder
        for img in result["images_to_generate"]:
            sample[img] = f"<InlineImage: {img}.png>"
        
        return sample


def main():
    """Função principal"""
    # Caminho do template
    template_path = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    
    try:
        # Criar analisador
        analyzer = TemplateAnalyzer(template_path)
        
        # Executar análise
        result = analyzer.analyze()
        
        # Imprimir resultados formatados
        analyzer.print_results(result)
        
        # Gerar JSON estruturado
        print("📄 JSON ESTRUTURADO:")
        print("-" * 70)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print()
        
        # Gerar exemplo de dados
        print("💡 EXEMPLO DE DADOS PARA PREENCHIMENTO:")
        print("-" * 70)
        sample_data = analyzer.generate_sample_json(result)
        print(json.dumps(sample_data, indent=2, ensure_ascii=False))
        print()
        
        # Salvar em arquivo
        output_file = Path(template_path).parent / "template_analysis.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                "analysis": result,
                "sample_data": sample_data
            }, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Análise salva em: {output_file}")
        print()
        
    except Exception as e:
        print(f"\n❌ ERRO: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
