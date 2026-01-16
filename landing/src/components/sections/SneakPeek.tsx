import { ContainerScroll } from "../ui/container-scroll-animation";

export function SneakPeek() {
  return (
    <section className="flex flex-col overflow-hidden bg-background py-10 md:py-20">
      <ContainerScroll
        titleComponent={
          <>
            <h2 className="text-3xl font-semibold text-foreground md:text-5xl lg:text-7xl">
              Toda a sua operação <br />
              <span className="text-primary text-5xl md:text-[6.5rem] font-bold mt-2 leading-none">
                Em uma única tela
              </span>
            </h2>
          </>
        }
      >
        <div className="aspect-video w-full h-full overflow-hidden rounded-xl">
          <video
            src="https://7sion.com/vid-demo.mp4"
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      </ContainerScroll>
    </section>
  );
}
