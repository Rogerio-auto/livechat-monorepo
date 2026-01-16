import React from "react";
import { NICHES } from "../../utils/constants";
import DisplayCards from "../ui/display-cards";
import { motion } from "framer-motion";
import { Badge } from "../ui/Badge";
import { 
  Sun, 
  GraduationCap, 
  Activity, 
  Building2, 
  Ticket, 
  Scale, 
  ShoppingBag 
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  solar: <Sun className="w-6 h-6 text-blue-500" />,
  education: <GraduationCap className="w-6 h-6 text-blue-500" />,
  health: <Activity className="w-6 h-6 text-blue-500" />,
  realestate: <Building2 className="w-6 h-6 text-blue-500" />,
  events: <Ticket className="w-6 h-6 text-blue-500" />,
  law: <Scale className="w-6 h-6 text-blue-500" />,
  retail: <ShoppingBag className="w-6 h-6 text-blue-500" />,
};

export const Niches: React.FC = () => {
  const displayCards = NICHES.map((niche) => ({
    title: niche.label,
    description: niche.metric,
    date: "Aprovado por especialistas",
    icon: iconMap[niche.id] || <Sun className="w-6 h-6 text-blue-500" />,
  }));

  return (
    <section id="niches" className="py-24 relative overflow-hidden bg-background min-h-[800px] flex items-center">
      <div className="container px-4 mx-auto relative z-10 text-foreground">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <div className="lg:w-5/12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Badge className="mb-4 bg-blue-500/10 text-blue-500 border-blue-500/20 px-3 py-1">
                EXCLUSIVO POR SEGMENTO
              </Badge>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
                Playbooks <span className="text-blue-500">Prontos</span> <br /> para seu Nicho
              </h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                Não comece do zero. Ative estratégias validadas de automação e IA 
                específicas para o seu setor, com fluxos, templates e dashboards 
                pré-configurados para escalar sua operação em tempo recorde.
              </p>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Configuração instantânea
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Metas de conversão pré-ajustadas
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Suporte especializado por nicho
                </div>
              </div>
            </motion.div>
          </div>

          <div className="lg:w-7/12 flex justify-center items-center relative perspective-1000">
            <motion.div 
              className="relative w-full max-w-md h-[500px] flex items-center justify-center"
              initial={{ opacity: 0, rotateY: -20, scale: 0.8 }}
              whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 1.2, ease: "circOut" }}
            >
              <DisplayCards cards={displayCards} />
              
              {/* Decorative Glow */}
              <div className="absolute -inset-20 bg-blue-600/20 blur-[120px] -z-10 rounded-full animate-pulse-subtle" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-blue-500/5 rounded-full -z-20 opacity-20" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
