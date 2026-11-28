import { createRoot, hydrateRoot } from "react-dom/client";
import { Profile } from "./Profile";

export function bootstrap() {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    if (!rootEl.innerHTML.trim()) createRoot(rootEl).render(<Profile />);
    else hydrateRoot(rootEl, <Profile />);
  }
}
