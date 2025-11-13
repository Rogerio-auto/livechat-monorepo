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
            Energia inteligente para um futuro sustentável
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mt-8">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <i className="fas fa-bolt text-blue-600 dark:text-blue-400"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Gestão Inteligente</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Monitore e controle seu sistema de energia em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-green-500/5 border border-green-500/10">
            <div className="shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <i className="fas fa-leaf text-green-600 dark:text-green-400"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Sustentabilidade</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contribua para um futuro mais verde e sustentável
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
            <div className="shrink-0 w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <i className="fas fa-chart-line text-purple-600 dark:text-purple-400"></i>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Relatórios Detalhados</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Acompanhe métricas e otimize seu consumo
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

        {/* Linha inferior */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">Rogério Viana</span>
          </span>
          <img
            src={Logo}
            alt="7 SION"
            className="h-10 w-auto object-contain opacity-80"
          />
        </div>
      </div>
    </div>
  )
}
