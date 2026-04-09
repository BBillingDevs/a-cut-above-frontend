import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function WholesaleEntryPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Mark intent to use wholesale section (UI/menus can react to this)
    localStorage.setItem("aca_wholesale_mode", "1");
    // send them to shop view
    navigate("/products", { replace: true });
  }, [navigate]);

  return null;
}
