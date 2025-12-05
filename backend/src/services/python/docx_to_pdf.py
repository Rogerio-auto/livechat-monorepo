"""
Conversor de DOCX para PDF usando docx2pdf
Modo produção: lê JSON do stdin e retorna JSON no stdout
"""

import sys
import json
from pathlib import Path

try:
    from docx2pdf import convert
except ImportError:
    print(json.dumps({
        'success': False,
        'error': 'docx2pdf não instalado. Execute: pip install docx2pdf'
    }), flush=True)
    sys.exit(1)


def convert_docx_to_pdf(docx_path: str, pdf_path: str = None) -> dict:
    """
    Converte arquivo DOCX para PDF
    
    Args:
        docx_path: Caminho do arquivo DOCX de entrada
        pdf_path: Caminho do arquivo PDF de saída (opcional, usa mesmo nome)
    
    Returns:
        dict com success, pdf_path e file_size
    """
    try:
        import time
        docx_path = Path(docx_path)
        
        if not docx_path.exists():
            return {
                'success': False,
                'error': f'Arquivo DOCX não encontrado: {docx_path}'
            }
        
        # Aguardar um pouco para garantir que o arquivo está fechado
        time.sleep(0.5)
        
        # Se não especificou caminho de saída, usa o mesmo diretório
        if pdf_path is None:
            pdf_path = docx_path.with_suffix('.pdf')
        else:
            pdf_path = Path(pdf_path)
        
        # Criar diretório de saída se não existir
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Converter DOCX para PDF
        # Nota: pode dar erro ao fechar Word mas PDF é gerado
        try:
            convert(str(docx_path), str(pdf_path))
        except AttributeError as e:
            # Erro conhecido: Word.Application.Quit
            # Ignorar, pois o PDF já foi gerado
            if 'Quit' not in str(e):
                raise
        
        # Aguardar conversão finalizar
        time.sleep(0.5)
        
        # Verificar se o PDF foi criado
        if not pdf_path.exists():
            return {
                'success': False,
                'error': 'Conversão executada mas arquivo PDF não foi criado'
            }
        
        # Obter tamanho do arquivo
        file_size = pdf_path.stat().st_size
        
        return {
            'success': True,
            'pdf_path': str(pdf_path.absolute()),
            'file_size': file_size
        }
        
    except Exception as e:
        # Mesmo com erro, verificar se PDF foi gerado
        if pdf_path and Path(pdf_path).exists():
            return {
                'success': True,
                'pdf_path': str(Path(pdf_path).absolute()),
                'file_size': Path(pdf_path).stat().st_size,
                'warning': f'PDF gerado mas houve erro: {str(e)}'
            }
        
        return {
            'success': False,
            'error': str(e),
            'traceback': __import__('traceback').format_exc()
        }


if __name__ == "__main__":
    # Modo produção: JSON via stdin/stdout
    if len(sys.argv) > 1 and sys.argv[1] == "--production":
        try:
            # Ler JSON do stdin
            input_data = sys.stdin.read()
            data = json.loads(input_data)
            
            docx_path = data.get('docx_path')
            pdf_path = data.get('pdf_path')  # opcional
            
            if not docx_path:
                result = {
                    'success': False,
                    'error': 'Campo "docx_path" é obrigatório'
                }
            else:
                result = convert_docx_to_pdf(docx_path, pdf_path)
            
            # Retornar JSON no stdout
            print(json.dumps(result), flush=True)
            sys.exit(0 if result['success'] else 1)
            
        except json.JSONDecodeError as e:
            print(json.dumps({
                'success': False,
                'error': f'JSON inválido: {str(e)}'
            }), flush=True)
            sys.exit(1)
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': str(e),
                'traceback': __import__('traceback').format_exc()
            }), flush=True)
            sys.exit(1)
    
    # Modo teste: argumentos de linha de comando
    else:
        if len(sys.argv) < 2:
            print("Uso:")
            print("  Modo produção: python docx_to_pdf.py --production < input.json")
            print("  Modo teste: python docx_to_pdf.py arquivo.docx [saida.pdf]")
            sys.exit(1)
        
        docx_path = sys.argv[1]
        pdf_path = sys.argv[2] if len(sys.argv) > 2 else None
        
        print(f"Convertendo: {docx_path}")
        if pdf_path:
            print(f"Saída: {pdf_path}")
        
        result = convert_docx_to_pdf(docx_path, pdf_path)
        
        if result['success']:
            print(f"OK! PDF gerado: {result['pdf_path']}")
            print(f"   Tamanho: {result['file_size']:,} bytes ({result['file_size']/1024:.2f} KB)")
        else:
            print(f"ERRO: {result['error']}")
            if 'traceback' in result:
                print(result['traceback'])
            sys.exit(1)
