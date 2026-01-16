type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export const SectionHeading = ({ eyebrow, title, description, align = "left" }: SectionHeadingProps) => (
  <div className={align === "center" ? "mx-auto mb-10 max-w-2xl text-center" : "mb-10 max-w-2xl"}>
    {eyebrow && (
      <span className="mb-3 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
        {eyebrow}
      </span>
    )}
    <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
    {description && <p className="mt-4 text-base text-muted-foreground">{description}</p>}
  </div>
);
