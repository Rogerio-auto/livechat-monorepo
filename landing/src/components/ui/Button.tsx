import { type ReactNode } from "react";
import clsx from "clsx";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const variantClasses = {
  primary: "bg-primary text-white shadow-soft hover:bg-primary-dark focus-visible:outline-primary",
  secondary:
    "bg-white text-slate-900 border border-slate-200 hover:border-primary hover:text-primary focus-visible:outline-primary",
  ghost: "text-slate-600 hover:text-primary",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

type BaseProps = {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type AnchorButtonProps = BaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type NativeButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonProps = AnchorButtonProps | NativeButtonProps;

type AnchorRestProps = Omit<AnchorButtonProps, keyof BaseProps | "href">;
type NativeRestProps = Omit<NativeButtonProps, keyof BaseProps>;

export const Button = (props: ButtonProps) => {
  const { variant = "primary", size = "md", icon, trailingIcon, className, children, href, ...rest } = props;
  const classes = clsx(baseClasses, variantClasses[variant], sizeClasses[size], className);

  if (href) {
    const anchorProps = rest as AnchorRestProps;
    return (
      <a href={href} className={classes} {...anchorProps}>
        {icon && <span className="text-lg">{icon}</span>}
        <span>{children}</span>
        {trailingIcon && <span className="text-lg">{trailingIcon}</span>}
      </a>
    );
  }

  const buttonProps = rest as NativeRestProps;
  return (
    <button className={classes} {...buttonProps} type={buttonProps.type ?? "button"}>
      {icon && <span className="text-lg">{icon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="text-lg">{trailingIcon}</span>}
    </button>
  );
};
