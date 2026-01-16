import { ContainerScroll } from "../ui/container-scroll-animation";

export function SneakPeek() {
  return (
    <section className="flex flex-col overflow-hidden bg-background py-20">
      <ContainerScroll
        titleComponent={
          <>
            <h2 className="text-3xl font-semibold text-foreground md:text-5xl lg:text-6xl">
              Toda a sua operação <br />
              <span className="text-primary text-4xl md:text-[6rem] font-bold mt-1 leading-none">
                Em uma única tela
              </span>
            </h2>
          </>
        }
      >
        <img
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop"
          alt="Painel de Controle 7Sion"
          className="mx-auto rounded-2xl object-cover h-full object-left-top w-full shadow-2xl"
          draggable={false}
        />
      </ContainerScroll>
    </section>
  );
}
