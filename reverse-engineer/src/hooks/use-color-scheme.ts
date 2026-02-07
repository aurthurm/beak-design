import { useCallback, useState } from "react";

export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState<string>(
    localStorage.getItem("theme") ?? "dark",
  );

  const toggleTheme = useCallback(() => {
    const newColorScheme = colorScheme === "light" ? "dark" : "light";
    localStorage.setItem("theme", newColorScheme);
    setColorScheme(newColorScheme);
  }, [colorScheme]);

  const setTheme = useCallback((theme: "dark" | "light") => {
    setColorScheme(theme);
  }, []);

  return {
    colorScheme,
    toggleTheme,
    setTheme,
  };
}
