import { Hero } from "../components/sections/Hero";
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
      <Hero />
      <SocialProof />
      <FeatureGrid />
      <Niches />
      <PricingPreview />
      <Testimonials />
      <FAQSection />
      <FinalCTA />
    </>
  );
};

export default Home;
