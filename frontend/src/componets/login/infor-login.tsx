import Logo from '../../assets/Logo.png'

export function InfLogin() {
  return (
    <div className="w-full h-full flex flex-col justify-between py-12">
      {/* Card com informações */}
      <div className="flex-1 flex flex-col justify-center space-y-8">
        {/* Título principal */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white leading-tight">
            Bem-vindo à <span className="text-blue-600 dark:text-blue-400">7 SION</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Plataforma completa de atendimento ao cliente
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mt-8">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <i className="fas fa-comments text-blue-600 dark:text-blue-400"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Atendimento Multicanal</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                WhatsApp, Instagram e outros canais em uma única plataforma
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-green-500/5 border border-green-500/10">
            <div className="shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <i className="fas fa-users text-green-600 dark:text-green-400"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Gestão de Equipe</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Organize departamentos e distribua conversas automaticamente
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
            <div className="shrink-0 w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <i className="fas fa-rocket text-purple-600 dark:text-purple-400"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Campanhas Inteligentes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Envie mensagens em massa e acompanhe resultados em tempo real
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-12 space-y-6">
        {/* Redes sociais */}
        <div className="flex flex-col items-center space-y-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Nos acompanhe nas redes sociais
          </span>
          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-all"
              aria-label="Facebook"
            >
              <i className="fab fa-facebook text-lg"></i>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-pink-500/10 hover:bg-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400 transition-all"
              aria-label="Instagram"
            >
              <i className="fab fa-instagram text-lg"></i>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 transition-all"
              aria-label="YouTube"
            >
              <i className="fab fa-youtube text-lg"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

