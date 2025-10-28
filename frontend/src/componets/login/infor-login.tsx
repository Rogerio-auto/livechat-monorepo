import Logo from '../../assets/Logo.png'

export function InfLogin() {
  return (
    <div className="min-h-screen flex justify-center">
      <div className="flex flex-col justify-between p-10 w-full">
        {/* Texto central */}
        <div className="flex flex-1 items-center justify-center">
          <h1 className="text-3xl font-bold text-white text-center leading-relaxed">
            Bem-vindo à <span className="text-green-400">SolarStrive</span>
            <br />
            Energia inteligente para um futuro sustentável.
          </h1>
        </div>

        {/* Rodapé */}
        <div className="w-full px-6 pb-6 space-y-4">
          {/* Redes sociais */}
          <div className="flex flex-col items-center space-y-2">
            <span className="text-white text-sm opacity-80">
              Nos acompanhe nas redes sociais
            </span>
            <div className="flex gap-4 text-xl text-white">
              <a
                href="#"
                className="hover:text-[#42CD55] transition"
                aria-label="Facebook"
              >
                <i className="fab fa-facebook"></i>
              </a>
              <a
                href="#"
                className="hover:text-[#42CD55] transition"
                aria-label="Instagram"
              >
                <i className="fab fa-instagram"></i>
              </a>
              <a
                href="#"
                className="hover:text-[#42CD55] transition"
                aria-label="YouTube"
              >
                <i className="fab fa-youtube"></i>
              </a>
            </div>
          </div>

          {/* Linha inferior: nome + logo */}
          <div className="flex items-center justify-between">
            {/* Nome do fundador */}
            <span className="text-white text-sm opacity-80">
              <span className="text-1xl font-semibold">Rogério Viana</span>
            </span>

            {/* Logo */}
            <img
              src={Logo}
              alt="SolarStrive"
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
