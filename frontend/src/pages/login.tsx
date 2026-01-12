import '../style.css';
import { CLogin } from '../components/login/compo-login';
import { InfLogin } from '../components/login/infor-login';

export function Login() {
  return (
    <main className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20 transition-colors duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Coluna esquerda - Formulário de Login */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <CLogin />
          </div>
        </div>

        {/* Coluna direita - Informações */}
        <div className="hidden lg:flex items-center justify-center p-6 lg:p-12 bg-linear-to-br from-blue-500/5 via-transparent to-transparent border-l border-gray-200 dark:border-gray-700">
          <div className="w-full max-w-md">
            <InfLogin />
          </div>
        </div>
      </div>
    </main>
  );
}
