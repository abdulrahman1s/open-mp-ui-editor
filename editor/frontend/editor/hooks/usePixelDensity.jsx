import { useEffect, useState } from "react";

export function usePixelDensity() {
  const [density, setDensity] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    const update = () => setDensity(window.devicePixelRatio || 1);
    const query = matchMedia(`(resolution: ${density}dppx)`);
    window.addEventListener("resize", update);
    query.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      query.removeEventListener("change", update);
    };
  }, [density]);
  return density;
}
