import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {

  // начальная тема
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  // применение темы
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);

    //плавность после первой загрузки
    requestAnimationFrame(() => {
      document.body.classList.add("theme-ready");
    });

    localStorage.setItem("theme", theme);
  }, [theme]);

  // переключение
  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}