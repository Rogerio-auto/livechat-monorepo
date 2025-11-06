import { useState } from 'react';

/**
 * Utilitários de Validação para Forms
 */

export const validators = {
  required: (value: string) => {
    if (!value || value.trim() === '') {
      return 'Este campo é obrigatório';
    }
    return null;
  },

  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Email inválido';
    }
    return null;
  },

  minLength: (min: number) => (value: string) => {
    if (value.length < min) {
      return `Mínimo de ${min} caracteres`;
    }
    return null;
  },

  maxLength: (max: number) => (value: string) => {
    if (value.length > max) {
      return `Máximo de ${max} caracteres`;
    }
    return null;
  },

  url: (value: string) => {
    try {
      new URL(value);
      return null;
    } catch {
      return 'URL inválida';
    }
  },

  phone: (value: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(value)) {
      return 'Telefone inválido';
    }
    return null;
  },
};

/**
 * Hook personalizado para gerenciar forms com validação
 */
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: Partial<Record<keyof T, (value: any) => string | null>>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const handleChange = (field: keyof T) => (value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Validar imediatamente se o campo já foi tocado
    if (touched[field] && validationRules[field]) {
      const error = validationRules[field]!(value);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    }
  };

  const handleBlur = (field: keyof T) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    if (validationRules[field]) {
      const error = validationRules[field]!(values[field]);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(validationRules).forEach((key) => {
      const field = key as keyof T;
      const error = validationRules[field]!(values[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset,
    setValues,
  };
}

/**
 * Exemplo de uso:
 * 
 * const { values, errors, handleChange, handleBlur, validate } = useFormValidation(
 *   { email: '', password: '' },
 *   {
 *     email: validators.email,
 *     password: validators.minLength(6)
 *   }
 * );
 * 
 * <Input
 *   label="Email"
 *   value={values.email}
 *   onChange={(e) => handleChange('email')(e.target.value)}
 *   onBlur={handleBlur('email')}
 *   error={errors.email}
 * />
 */
