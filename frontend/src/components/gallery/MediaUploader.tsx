import { useState, useCallback, useEffect } from "react";
import { FiX, FiUpload, FiLoader } from "react-icons/fi";

interface MediaUploaderProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Product = {
  id: string;
  name: string;
  sale_price?: number | null;
};

export default function MediaUploader({ onClose, onSuccess }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    alt_text: "",
    category: "product",
    tags: "",
    catalog_item_ids: [] as string[],
  });

  // Buscar produtos para vincular
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/products`,
          {
            credentials: "include",
          }
        );

        if (response.ok) {
          const data = await response.json();
          setProducts(data.items || []);
        }
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);

    // Gerar preview se for imagem
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview("");
    }

    // Auto-fill title com nome do arquivo
    if (!formData.title) {
      setFormData((prev) => ({
        ...prev,
        title: selectedFile.name.split(".")[0],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert("Selecione um arquivo");
      return;
    }

    setUploading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("title", formData.title);
      uploadFormData.append("description", formData.description);
      uploadFormData.append("alt_text", formData.alt_text);
      uploadFormData.append("category", formData.category);
      uploadFormData.append("tags", JSON.stringify(formData.tags.split(",").map((t) => t.trim()).filter(Boolean)));
      uploadFormData.append("is_public", "true");
      
      // Adicionar produtos vinculados
      if (formData.catalog_item_ids.length > 0) {
        formData.catalog_item_ids.forEach((id) => {
          uploadFormData.append("catalog_item_ids[]", id);
        });
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/media/upload`,
        {
          method: "POST",
          credentials: "include",
          body: uploadFormData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro no upload:", error);
      alert(error instanceof Error ? error.message : "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      catalog_item_ids: prev.catalog_item_ids.includes(productId)
        ? prev.catalog_item_ids.filter((id) => id !== productId)
        : [...prev.catalog_item_ids, productId],
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
    >
      <div
        className="theme-surface rounded-xl shadow-md w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid var(--color-border)" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 theme-surface flex items-center justify-between p-6 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="theme-heading text-2xl font-semibold">Upload de Mídia</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: "var(--color-surface-muted)",
              color: "var(--color-text)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-muted)";
            }}
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive ? "border-blue-500 bg-blue-500 bg-opacity-10" : ""
            }`}
            style={{
              borderColor: dragActive ? "var(--color-primary)" : "var(--color-border)",
              backgroundColor: dragActive ? "var(--color-primary-alpha)" : "var(--color-surface-muted)",
            }}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />

            {preview ? (
              <div className="space-y-4">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-lg"
                  style={{ border: "1px solid var(--color-border)" }}
                />
                <p className="theme-text-muted text-sm">{file?.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview("");
                  }}
                  className="theme-secondary px-4 py-2 rounded-lg"
                >
                  Remover
                </button>
              </div>
            ) : file ? (
              <div className="space-y-4">
                <FiUpload size={48} className="mx-auto" style={{ color: "var(--color-primary)" }} />
                <p className="theme-heading font-medium">{file.name}</p>
                <p className="theme-text-muted text-sm">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="theme-secondary px-4 py-2 rounded-lg"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <FiUpload size={48} className="mx-auto" style={{ color: "var(--color-text-muted)" }} />
                <div>
                  <p className="theme-heading font-medium mb-2">
                    Arraste e solte seu arquivo aqui
                  </p>
                  <p className="theme-text-muted text-sm mb-4">
                    ou clique para selecionar
                  </p>
                  <label
                    htmlFor="file-upload"
                    className="theme-primary px-6 py-2 rounded-lg cursor-pointer inline-block"
                  >
                    Escolher Arquivo
                  </label>
                </div>
                <p className="theme-text-muted text-xs">
                  Formatos suportados: imagens, vídeos, áudios, PDF, DOC, DOCX
                  <br />
                  Tamanho máximo: 100MB
                </p>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block theme-text-muted text-sm font-medium mb-2">
                Título *
              </label>
              <input
                type="text"
                required
                className="theme-input w-full px-4 py-2 rounded-lg"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="block theme-text-muted text-sm font-medium mb-2">
                Descrição
              </label>
              <textarea
                className="theme-input w-full px-4 py-2 rounded-lg"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block theme-text-muted text-sm font-medium mb-2">
                Texto Alternativo (Alt)
              </label>
              <input
                type="text"
                className="theme-input w-full px-4 py-2 rounded-lg"
                value={formData.alt_text}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, alt_text: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block theme-text-muted text-sm font-medium mb-2">
                Categoria
              </label>
              <select
                className="theme-input w-full px-4 py-2 rounded-lg"
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                <option value="product">Produto</option>
                <option value="service">Serviço</option>
                <option value="subscription">Assinatura</option>
                <option value="promotion">Promoção</option>
                <option value="general">Geral</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block theme-text-muted text-sm font-medium mb-2">
                Tags (separadas por vírgula)
              </label>
              <input
                type="text"
                className="theme-input w-full px-4 py-2 rounded-lg"
                placeholder="exemplo, tag1, tag2"
                value={formData.tags}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Product Selector */}
          <div>
            <label className="block theme-text-muted text-sm font-medium mb-3">
              Vincular a Produtos/Serviços
            </label>
            
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="animate-spin" size={24} style={{ color: "var(--color-primary)" }} />
              </div>
            ) : products.length === 0 ? (
              <p className="theme-text-muted text-sm py-4">
                Nenhum produto cadastrado ainda.
              </p>
            ) : (
              <div
                className="rounded-xl p-4 max-h-64 overflow-y-auto space-y-2"
                style={{
                  backgroundColor: "var(--color-surface-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                    style={{
                      backgroundColor: formData.catalog_item_ids.includes(product.id)
                        ? "var(--color-primary-alpha)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!formData.catalog_item_ids.includes(product.id)) {
                        e.currentTarget.style.backgroundColor = "var(--color-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!formData.catalog_item_ids.includes(product.id)) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.catalog_item_ids.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="w-4 h-4"
                      style={{ accentColor: "var(--color-primary)" }}
                    />
                    <div className="flex-1">
                      <p className="theme-heading text-sm font-medium">{product.name}</p>
                      {product.sale_price && (
                        <p className="theme-text-muted text-xs">
                          R$ {product.sale_price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            
            {formData.catalog_item_ids.length > 0 && (
              <p className="theme-text-muted text-xs mt-2">
                {formData.catalog_item_ids.length} produto(s) selecionado(s)
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button
              type="button"
              onClick={onClose}
              className="theme-secondary px-6 py-2 rounded-lg"
              disabled={uploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="theme-primary px-6 py-2 rounded-lg flex items-center gap-2"
              disabled={uploading || !file}
            >
              {uploading ? (
                <>
                  <FiLoader className="animate-spin" size={16} />
                  Enviando...
                </>
              ) : (
                <>
                  <FiUpload size={16} />
                  Fazer Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

