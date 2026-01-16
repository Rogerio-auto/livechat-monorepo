"use client";

import { MessageSquare, Bot, Users, BarChart3, Rocket } from "lucide-react";
import RadialOrbitalTimeline from "../ui/radial-orbital-timeline";
import { Button } from "../ui/Button";

const timelineData = [
  {
    id: 1,
    title: "Conexão",
    date: "Passo 1",
    content: "Conecte seu WhatsApp, Instagram e Facebook em minutos via WAHA e Meta Cloud API.",
    category: "Setup",
    icon: MessageSquare,
    relatedIds: [2],
    status: "completed" as const,
    energy: 100,
  },
  {
    id: 2,
    title: "IA & Fluxos",
    date: "Passo 2",
    content: "Configure seus agentes de IA e crie fluxos de automação sem código para qualificar leads.",
    category: "Automation",
    icon: Bot,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 95,
  },
  {
    id: 3,
    title: "Vendas",
    date: "Passo 3",
    content: "Inicie campanhas em massa, organize contatos no CRM e gerencie tarefas do seu time.",
    category: "Execution",
    icon: Users,
    relatedIds: [2, 4],
    status: "in-progress" as const,
    energy: 80,
  },
  {
    id: 4,
    title: "Análise",
    date: "Passo 4",
    content: "Acompanhe funis de conversão, performance de atendentes e ROI das suas campanhas.",
    category: "Analytics",
    icon: BarChart3,
    relatedIds: [3, 5],
    status: "pending" as const,
    energy: 50,
  },
  {
    id: 5,
    title: "Escala",
    date: "Passo 5",
    content: "Escalone seu negócio com white-label e gerencie múltiplas caixas de entrada.",
    category: "Growth",
    icon: Rocket,
    relatedIds: [4],
    status: "pending" as const,
    energy: 20,
  },
];

export function TimelineSection() {
  return (
    <section className="py-32 bg-slate-950 overflow-hidden relative" id="como-funciona">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-left">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              A Jornada do <span className="text-primary">Sucesso</span> Automatizada
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-xl">
              Nossa plataforma guia sua operação através de 5 marcos estratégicos, desde a primeira conexão até a escala global com IA.
            </p>
            
            <div className="space-y-6">
              {[
                { title: "Escalabilidade Infinita", desc: "Gerencie milhares de leads sem aumentar o time." },
                { title: "Automação Inteligente", desc: "Fluxos que aprendem e evoluem com seu cliente." },
                { title: "Segurança de Dados", desc: "Protocolos de nível bancário para sua operação." }
              ].map((item) => (
                <div key={item.title} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Rocket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{item.title}</h4>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-10">
              <Button size="lg" className="rounded-full px-8">Começar jornada</Button>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/10 blur-3xl opacity-30 rounded-full" />
            <RadialOrbitalTimeline timelineData={timelineData} />
          </div>
        </div>
      </div>
    </section>
  );
}
