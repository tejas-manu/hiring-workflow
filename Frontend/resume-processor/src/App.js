import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import Dashboard from "./Dashboard";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route goes to HomePage */}
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs/:jobId" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
