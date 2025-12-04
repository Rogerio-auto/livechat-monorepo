"""
Script auxiliar: Exporta o XML limpo do DOCX para inspeção manual
Útil para verificar se há variáveis simples {{ }} que não foram detectadas
"""

import re
import zipfile
from pathlib import Path

def export_clean_xml(template_path: str, output_path: str = None):
    """Exporta o XML limpo do DOCX para um arquivo de texto"""
    
    template_path = Path(template_path)
    
    if not template_path.exists():
        raise FileNotFoundError(f"Template não encontrado: {template_path}")
    
    # Caminho de saída padrão
    if output_path is None:
        output_path = template_path.parent / f"{template_path.stem}_xml_limpo.txt"
    
    print(f"📄 Lendo: {template_path.name}")
    
    # Extrair XML
    with zipfile.ZipFile(template_path, 'r') as docx_zip:
        with docx_zip.open('word/document.xml') as xml_file:
            raw_xml = xml_file.read().decode('utf-8')
    
    # Limpar tags do Word
    clean_xml = re.sub(r'<w:t[^>]*>', '', raw_xml)
    clean_xml = re.sub(r'</w:t>', '', clean_xml)
    clean_xml = re.sub(r'<w:r[^>]*>', '', clean_xml)
    clean_xml = re.sub(r'</w:r>', '', clean_xml)
    
    # Salvar
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(clean_xml)
    
    print(f"✅ XML limpo salvo em: {output_path}")
    print(f"📊 Tamanho: {len(clean_xml):,} caracteres")
    
    # Buscar variáveis simples manualmente
    simple_vars = re.findall(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}', clean_xml)
    if simple_vars:
        print(f"\n🔍 Possíveis variáveis simples encontradas:")
        for var in sorted(set(simple_vars)):
            if '.' not in var:  # Ignorar variáveis de loop
                print(f"   - {var}")
    else:
        print("\n⚠️  Nenhuma variável simples {{ }} detectada")
        print("   Isso é normal se todas as variáveis estão dentro de loops")
    
    return output_path

if __name__ == "__main__":
    template = r"C:\Users\roger\Downloads\Proposta 2025 (1).docx"
    export_clean_xml(template)
