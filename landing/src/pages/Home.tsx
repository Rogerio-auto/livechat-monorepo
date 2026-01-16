import { Hero as AnimatedHero } from "../components/ui/animated-hero";
import { HeroGeometric } from "../components/ui/shape-landing-hero";
import { ShaderAnimation } from "../components/ui/shader-animation";
import { Suspense, lazy } from "react";
import { usePageMeta } from "../hooks/usePageMeta";

// Lazy loaded sections
const SneakPeek = lazy(() => import("../components/sections/SneakPeek").then(m => ({ default: m.SneakPeek })));
const TimelineSection = lazy(() => import("../components/sections/TimelineSection").then(m => ({ default: m.TimelineSection })));
const SocialProof = lazy(() => import("../components/sections/SocialProof").then(m => ({ default: m.SocialProof })));
const FeatureGrid = lazy(() => import("../components/sections/FeatureGrid").then(m => ({ default: m.FeatureGrid })));
const Niches = lazy(() => import("../components/sections/Niches").then(m => ({ default: m.Niches })));
const PricingPreview = lazy(() => import("../components/sections/PricingPreview").then(m => ({ default: m.PricingPreview })));
const Testimonials = lazy(() => import("../components/sections/Testimonials").then(m => ({ default: m.Testimonials })));
const FAQSection = lazy(() => import("../components/sections/FAQSection").then(m => ({ default: m.FAQSection })));
const FinalCTA = lazy(() => import("../components/sections/FinalCTA").then(m => ({ default: m.FinalCTA })));

const SectionLoader = () => (
  <div className="w-full py-40 flex items-center justify-center opacity-20">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

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
        <Suspense fallback={<SectionLoader />}>
          <SneakPeek />
          <SocialProof />
          <TimelineSection />
          <FeatureGrid />
          <Niches />
          <PricingPreview />
          <Testimonials />
          <FAQSection />
          <FinalCTA />
        </Suspense>
      </div>
    </>
  );
};

export default Home;
