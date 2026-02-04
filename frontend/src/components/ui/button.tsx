import * as React from "react"
import { cn } from "@/utils/cn"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-button font-medium transition-all",
          {
            "bg-brand text-white hover:bg-brand-hover px-6 py-3 dark:bg-brand dark:hover:bg-brand-hover": variant === "default",
            "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-6 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600": variant === "outline",
            "text-gray-700 hover:bg-gray-100 px-4 py-2 dark:text-gray-300 dark:hover:bg-gray-700": variant === "ghost",
            "text-sm px-4 py-2": size === "sm",
            "text-lg px-8 py-4": size === "lg",
            "p-2 h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
