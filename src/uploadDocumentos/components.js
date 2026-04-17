// ./components/ui/button.jsx
export const Button = ({ children, className = '', ...props }) => {
    return (
      <button
        {...props}
        className={`inline-flex items-center justify-center rounded-md bg-primary text-white px-4 py-2 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {children}
      </button>
    );
  };
  
  
  // ./components/ui/label.jsx
  export const Label = ({ children, htmlFor, className = "" }) => {
    return (
      <label htmlFor={htmlFor} className={`block text-sm font-medium ${className}`}>
        {children}
      </label>
    );
  };
  
  
  // ./hooks/useToast.jsx
  export const useToast = () => {
    return {
      toast: ({ title, description, variant }) => {
        const color = variant === "destructive" ? "\x1b[31m" : "\x1b[32m";
        console.log(`${color}%s\x1b[0m`, `${title}: ${description || ""}`);
      }
    };
  };
  