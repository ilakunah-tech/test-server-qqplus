import * as React from "react"
import { cn } from "@/utils/cn"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-input border px-3 py-2 text-sm",
          "border-gray-300 bg-white text-gray-900",
          "dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100",
          "focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }
