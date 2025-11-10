// Tipos compartilhados para o Meta Template Wizard

export interface HeaderComponent {
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[];
  };
}

export interface BodyComponent {
  text: string;
  examples?: string[][];
}

export interface ButtonComponent {
  type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL' | 'COPY_CODE';
  text: string;
  phone_number?: string;
  url?: string;
  example?: string[];
}

export interface MetaTemplateData {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  header?: HeaderComponent;
  body: BodyComponent;
  footer?: string;
  buttons?: ButtonComponent[];
}
