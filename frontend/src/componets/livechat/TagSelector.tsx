import React, { useState, useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";

type Tag = {
  id: string;
  name: string;
  color?: string | null;
};

type Props = {
  apiBase: string;
  selectedTags: string[]; // array de nomes de tags
  onChange: (tags: string[]) => void;
};

export default function TagSelector({ apiBase, selectedTags, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Carregar tags da empresa
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/livechat/tags`, {
          credentials: "include",
        });
        if (!res.ok) return;
        
        const data = await res.json();
        setTags(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("Falha ao carregar tags", e);
      }
    })();
  }, [apiBase]);

  // Filtrar tags conforme o usuário digita
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredTags(tags.filter(tag => !selectedTags.includes(tag.name)));
      return;
    }

    const query = inputValue.toLowerCase();
    const filtered = tags.filter(
      (tag) =>
        !selectedTags.includes(tag.name) &&
        tag.name.toLowerCase().includes(query)
    );
    setFilteredTags(filtered);
  }, [inputValue, tags, selectedTags]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectTag = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      onChange([...selectedTags, tagName]);
    }
    setInputValue("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagName: string) => {
    onChange(selectedTags.filter((name) => name !== tagName));
  };

  const getTagByName = (name: string) => tags.find((tag) => tag.name === name);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Tags
      </label>
      
      {/* Tags selecionadas */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tagName) => {
            const tag = getTagByName(tagName);
            return (
              <div
                key={tagName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
              >
                {tag?.color && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tagName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tagName)}
                  className="ml-1 hover:text-purple-900 dark:hover:text-purple-300 transition-colors"
                  aria-label={`Remover ${tagName}`}
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input com autocomplete */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={
            selectedTags.length === 0
              ? "Digite para buscar tags..."
              : "Adicionar mais tags..."
          }
          className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors"
        />

        {/* Dropdown de sugestões */}
        {showDropdown && filteredTags.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-auto"
          >
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleSelectTag(tag.name)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                {tag.color && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span className="text-gray-900 dark:text-white">{tag.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mensagem quando não há resultados */}
        {showDropdown && inputValue.trim() && filteredTags.length === 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Nenhuma tag encontrada
            </p>
          </div>
        )}
      </div>

      {tags.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Nenhuma tag disponível
        </p>
      )}
    </div>
  );
}
