import React, { createContext, useContext, useState } from "react";

const TabsContext = createContext({});

export const Tabs = ({ value, onValueChange, defaultValue, className = "", children, ...props }) => {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const current = value !== undefined ? value : internalValue;
  const onChange = onValueChange || setInternalValue;

  return (
    <TabsContext.Provider value={{ current, onChange }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className = "", children, ...props }) => (
  <div
    className={`inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${className}`}
    role="tablist"
    {...props}
  >
    {children}
  </div>
);

export const TabsTrigger = ({ value, className = "", children, ...props }) => {
  const { current, onChange } = useContext(TabsContext);
  const isActive = current === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium
        transition-all focus:outline-none disabled:pointer-events-none disabled:opacity-50
        ${isActive ? "bg-background text-foreground shadow" : "hover:bg-background/50 hover:text-foreground"}
        ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, className = "", children, ...props }) => {
  const { current } = useContext(TabsContext);
  if (current !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-2 focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};