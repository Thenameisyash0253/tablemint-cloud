import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import CustomerOrder from "./CustomerOrder.jsx";
import QRManager from "./QRManager.jsx";
import "./styles.css";

const path = window.location.pathname;
const Page = path === "/order" ? CustomerOrder : path === "/qr" ? QRManager : App;
createRoot(document.getElementById("root")).render(<React.StrictMode><Page /></React.StrictMode>);
