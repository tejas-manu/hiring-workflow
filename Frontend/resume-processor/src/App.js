import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import Login from "./Login";
import Dashboard from "./Dashboard";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* ✅ New route to show Dashboard for specific job */}
        <Route path="/jobs/:jobId" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
