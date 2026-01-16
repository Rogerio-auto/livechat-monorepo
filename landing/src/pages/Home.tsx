import { Hero as AnimatedHero } from "../components/ui/animated-hero";
import { HeroGeometric } from "../components/ui/shape-landing-hero";
import { ShaderAnimation } from "../components/ui/shader-animation";
import { SneakPeek } from "../components/sections/SneakPeek";
import { TimelineSection } from "../components/sections/TimelineSection";
import { SocialProof } from "../components/sections/SocialProof";
import { FeatureGrid } from "../components/sections/FeatureGrid";
import { Niches } from "../components/sections/Niches";
import { PricingPreview } from "../components/sections/PricingPreview";
import { Testimonials } from "../components/sections/Testimonials";
import { FAQSection } from "../components/sections/FAQSection";
import { FinalCTA } from "../components/sections/FinalCTA";
import { usePageMeta } from "../hooks/usePageMeta";

const Home = () => {
  usePageMeta({
    title: "Plataforma Conversacional Omnichannel",
    description: "Transforme sua comunicação com nossa solução completa de atendimento, IA e CRM integrado.",
  });

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0 h-screen pointer-events-none opacity-40">
          <ShaderAnimation />
        </div>
        <HeroGeometric 
          badge="7Sion Omnichannel AI"
          title1="O Futuro do seu"
          title2="Atendimento é Aqui"
        >
          <div className="relative z-10">
            <AnimatedHero />
          </div>
        </HeroGeometric>
      </section>
      
      <div className="relative z-10 bg-background">
        <SneakPeek />
        <SocialProof />
        <TimelineSection />
        <FeatureGrid />
        <Niches />
        <PricingPreview />
        <Testimonials />
        <FAQSection />
        <FinalCTA />
      </div>
    </>
  );
};

export default Home;
