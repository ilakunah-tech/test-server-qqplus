import * as React from "react"
import { cn } from "@/utils/cn"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300 ease-smooth active:scale-[0.97]",
          {
            "bg-gradient-to-r from-brand to-qq-flame text-white hover:from-brand-hover hover:to-qq-flame-dark hover:shadow-[0_8px_30px_rgba(232,93,4,0.3)] px-6 py-3 border border-qq-flame/20 shadow-lg shadow-brand/20": variant === "default",
            "border border-stone-200 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm text-gray-700 dark:text-gray-200 hover:bg-stone-50 dark:hover:bg-white/10 hover:border-brand/30 px-6 py-3": variant === "outline",
            "text-gray-700 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-white/5 px-4 py-2 rounded-lg": variant === "ghost",
            "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:shadow-[0_8px_30px_rgba(239,68,68,0.3)] px-6 py-3 shadow-lg shadow-red-500/20": variant === "destructive",
            "text-sm px-4 py-2": size === "sm",
            "text-lg px-8 py-4": size === "lg",
            "p-2 h-10 w-10": size === "icon",
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
