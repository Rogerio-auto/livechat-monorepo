import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "./Button";
import { HERO_STATS } from "../../utils/constants";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["Vendas", "Atendimento", "Automação", "Escalabilidade", "Inteligência"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full relative">
      <div className="mx-auto px-4">
        <div className="flex gap-8 py-10 items-center justify-center flex-col">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button variant="outline" size="sm" className="gap-4 rounded-full bg-white/5 backdrop-blur-md border-white/10 hover:border-primary/50 transition-all text-white/80" asChild>
              <a href="#como-funciona">
                <span className="text-primary font-bold">NOVO</span>
                Conheça a nova era do CRM <MoveRight className="w-4 h-4 text-primary" />
              </a>
            </Button>
          </motion.div>
          
          <div className="flex gap-4 flex-col items-center w-full">
            <motion.h1 
              className="text-4xl sm:text-5xl md:text-8xl max-w-4xl tracking-tighter text-center font-bold"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <span className="text-white block">IA para suas</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center py-2 md:pb-6 md:pt-4 text-primary min-h-[1.1em]">
                {/* Ghost text with natural height to ensure container matches the largest word */}
                <span className="invisible opacity-0 pointer-events-none whitespace-nowrap select-none">Escalabilidade</span>
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-bold whitespace-nowrap px-2"
                    initial={{ opacity: 0, y: "100%" }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? "-120%" : "120%",
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </motion.h1>

            <motion.p 
              className="text-lg md:text-xl leading-relaxed tracking-tight text-white/60 max-w-2xl text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
            >
              Pare de perder tempo com processos manuais. Nossa plataforma centraliza seus canais, automatiza suas vendas e escala seu atendimento com IA de ponta.
            </motion.p>
          </div>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <Button size="lg" className="gap-4 rounded-full px-8 py-7 text-lg group bg-white text-slate-950 hover:bg-white/90" asChild>
              <a href="#como-funciona">Ver em detalhes <PhoneCall className="w-4 h-4 group-hover:rotate-12 transition-transform" /></a>
            </Button>
            <Button size="lg" variant="default" className="gap-4 rounded-full px-8 py-7 text-lg glow-primary" asChild>
              <a href="/precos">Começar agora <MoveRight className="w-4 h-4" /></a>
            </Button>
          </motion.div>

          <motion.div 
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 w-full max-w-4xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="text-center p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all cursor-default group">
                <p className="text-4xl font-bold text-white group-hover:text-primary transition-colors">{stat.value}</p>
                <p className="text-sm font-semibold text-white/40 mt-1">{stat.label}</p>
                <p className="text-xs text-white/20 mt-2">{stat.detail}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
